package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/bookings"
	"gorm.io/gorm"
)

const printerBody = `{"Name": " Printer ", "Category": "3D printers", "Location": " Bench ", "Description": "", "Status": "ACTIVE"}`

func newTestEquipment(t *testing.T, db *gorm.DB, equipment bookings.Equipment) bookings.Equipment {
	t.Helper()

	if equipment.Name == "" {
		equipment.Name = "Test equipment"
	}
	if equipment.Category == "" {
		equipment.Category = "Test"
	}
	if equipment.Location == "" {
		equipment.Location = "Bench"
	}
	if equipment.Status == "" {
		equipment.Status = bookings.EquipmentActive
	}
	if equipment.CloseHour == 0 {
		equipment.CloseHour = 24
	}
	if err := db.Create(&equipment).Error; err != nil {
		t.Fatal(err)
	}
	return equipment
}

// tomorrowAt returns a local time tomorrow, always inside the seven-day booking window.
func tomorrowAt(hour int) time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day()+1, hour, 0, 0, 0, time.Local)
}

func bookingBody(equipmentID int, start, end time.Time, purpose string) string {
	return fmt.Sprintf(`{"EquipmentID": %d, "Start": %q, "End": %q, "Purpose": %q}`,
		equipmentID, start.UTC().Format(time.RFC3339), end.UTC().Format(time.RFC3339), purpose)
}

func decodeBooking(t *testing.T, body []byte) bookings.BookingDTO {
	t.Helper()

	var result struct {
		Booking bookings.BookingDTO `json:"booking"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	return result.Booking
}

func TestBookingReadsRequireActiveSession(t *testing.T) {
	router, db := newAuthRouter(t)
	_, activeToken := newTestSession(t, db)
	disabled, disabledToken := newTestSession(t, db)
	if err := db.Model(&disabled).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{"/equipment", "/bookings"} {
		t.Run(path, func(t *testing.T) {
			requireStatus(t, makeRequest(router, http.MethodGet, path, "", ""), http.StatusUnauthorized)
			requireStatus(t, makeRequest(router, http.MethodGet, path, "", disabledToken), http.StatusForbidden)
			requireStatus(t, makeRequest(router, http.MethodGet, path, "", activeToken), http.StatusOK)
		})
	}
}

func TestEquipmentPermissionsAreIndependent(t *testing.T) {
	router, db := newAuthRouter(t)
	_, noneToken := newTestSession(t, db)
	_, addToken := newTestSession(t, db, auth.PermissionBookingAdd)
	_, modifyToken := newTestSession(t, db, auth.PermissionBookingModify)
	_, deleteToken := newTestSession(t, db, auth.PermissionBookingDelete)

	requireStatus(t, makeRequest(router, http.MethodPost, "/equipment", printerBody, noneToken), http.StatusForbidden)
	requireStatus(t, makeRequest(router, http.MethodPost, "/equipment", printerBody, modifyToken), http.StatusForbidden)

	response := makeRequest(router, http.MethodPost, "/equipment", printerBody, addToken)
	requireStatus(t, response, http.StatusCreated)
	var created struct {
		Equipment bookings.Equipment `json:"equipment"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Equipment.Name != "Printer" || created.Equipment.Location != "Bench" {
		t.Errorf("Expected trimmed name and location, got %+v", created.Equipment)
	}
	if created.Equipment.OpenHour != 0 || created.Equipment.CloseHour != 24 {
		t.Errorf("Expected 3D printers to default to 24 hours, got %d-%d", created.Equipment.OpenHour, created.Equipment.CloseHour)
	}

	path := "/equipment/" + strconv.Itoa(created.Equipment.ID)
	update := `{"Name": "Workshop tool", "Category": "Tools", "Location": "Bench", "Status": "MAINTENANCE", "MaintenanceNote": " Broken "}`
	requireStatus(t, makeRequest(router, http.MethodPut, path, update, addToken), http.StatusForbidden)
	response = makeRequest(router, http.MethodPut, path, update, modifyToken)
	requireStatus(t, response, http.StatusOK)

	var stored bookings.Equipment
	if err := db.First(&stored, created.Equipment.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Status != bookings.EquipmentMaintenance || stored.MaintenanceNote != "Broken" {
		t.Errorf("Expected maintenance status and note, got %+v", stored)
	}
	if stored.OpenHour != bookings.DefaultOpenHour || stored.CloseHour != bookings.DefaultCloseHour {
		t.Errorf("Expected default hours for a non-printer category, got %d-%d", stored.OpenHour, stored.CloseHour)
	}

	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", modifyToken), http.StatusForbidden)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", deleteToken), http.StatusNoContent)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", deleteToken), http.StatusNotFound)
	requireStatus(t, makeRequest(router, http.MethodPut, path, update, modifyToken), http.StatusNotFound)
}

func TestEquipmentValidation(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	for name, body := range map[string]string{
		"closing before opening": `{"Name": "A", "Category": "B", "Location": "C", "Status": "ACTIVE", "OpenHour": 20, "CloseHour": 8}`,
		"hours past midnight":    `{"Name": "A", "Category": "B", "Location": "C", "Status": "ACTIVE", "OpenHour": 8, "CloseHour": 25}`,
		"invalid status":         `{"Name": "A", "Category": "B", "Location": "C", "Status": "BROKEN"}`,
		"blank name":             `{"Name": "  ", "Category": "B", "Location": "C", "Status": "ACTIVE"}`,
		"missing location":       `{"Name": "A", "Category": "B", "Status": "ACTIVE"}`,
	} {
		t.Run(name, func(t *testing.T) {
			requireStatus(t, makeRequest(router, http.MethodPost, "/equipment", body, token), http.StatusBadRequest)
		})
	}

	var count int64
	if err := db.Model(&bookings.Equipment{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Errorf("Expected no equipment to be created, found %d", count)
	}
}

func TestDeleteEquipmentRemovesItsBookings(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newTestSession(t, db, auth.PermissionBookingDelete)
	equipment := newTestEquipment(t, db, bookings.Equipment{})
	other := newTestEquipment(t, db, bookings.Equipment{})
	for _, id := range []int{equipment.ID, other.ID} {
		if err := db.Create(&bookings.Booking{EquipmentID: id, UserID: user.ID, Start: tomorrowAt(10), End: tomorrowAt(11)}).Error; err != nil {
			t.Fatal(err)
		}
	}

	requireStatus(t, makeRequest(router, http.MethodDelete, "/equipment/"+strconv.Itoa(equipment.ID), "", token), http.StatusNoContent)

	var remaining []bookings.Booking
	if err := db.Find(&remaining).Error; err != nil {
		t.Fatal(err)
	}
	if len(remaining) != 1 || remaining[0].EquipmentID != other.ID {
		t.Errorf("Expected only the other equipment's booking to remain, got %+v", remaining)
	}
}

func TestCreateBooking(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newTestSession(t, db)
	equipment := newTestEquipment(t, db, bookings.Equipment{})

	response := makeRequest(router, http.MethodPost, "/bookings", bookingBody(equipment.ID, tomorrowAt(10), tomorrowAt(12), " Prototype "), token)
	requireStatus(t, response, http.StatusCreated)
	created := decodeBooking(t, response.Body.Bytes())
	if !created.Mine || created.UserName != user.Name || created.Purpose != "Prototype" || created.EquipmentID != equipment.ID {
		t.Errorf("Unexpected booking %+v", created)
	}
	if !created.Start.Equal(tomorrowAt(10)) || !created.End.Equal(tomorrowAt(12)) {
		t.Errorf("Expected 10:00-12:00 tomorrow, got %s-%s", created.Start, created.End)
	}

	var stored bookings.Booking
	if err := db.First(&stored, created.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.UserID != user.ID {
		t.Errorf("Expected booking to belong to %s, got %s", user.ID, stored.UserID)
	}
}

func TestCreateBookingRules(t *testing.T) {
	router, db := newAuthRouter(t)
	owner, ownerToken := newTestSession(t, db)
	_, token := newTestSession(t, db)
	equipment := newTestEquipment(t, db, bookings.Equipment{})
	hours := newTestEquipment(t, db, bookings.Equipment{OpenHour: 9, CloseHour: 17})
	broken := newTestEquipment(t, db, bookings.Equipment{Status: bookings.EquipmentMaintenance})
	if err := db.Create(&bookings.Booking{EquipmentID: equipment.ID, UserID: owner.ID, Start: tomorrowAt(10).UTC(), End: tomorrowAt(12).UTC()}).Error; err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	for _, test := range []struct {
		name   string
		body   string
		status int
	}{
		{"overlap", bookingBody(equipment.ID, tomorrowAt(11), tomorrowAt(13), ""), http.StatusConflict},
		{"in the past", bookingBody(equipment.ID, now.Add(-2*time.Hour), now.Add(-time.Hour), ""), http.StatusBadRequest},
		{"end before start", bookingBody(equipment.ID, tomorrowAt(14), tomorrowAt(13), ""), http.StatusBadRequest},
		{"longer than eight hours", bookingBody(equipment.ID, tomorrowAt(12), tomorrowAt(21), ""), http.StatusBadRequest},
		{"beyond seven days", bookingBody(equipment.ID, tomorrowAt(10).AddDate(0, 0, 7), tomorrowAt(11).AddDate(0, 0, 7), ""), http.StatusBadRequest},
		{"before opening", bookingBody(hours.ID, tomorrowAt(8), tomorrowAt(10), ""), http.StatusBadRequest},
		{"after closing", bookingBody(hours.ID, tomorrowAt(16), tomorrowAt(18), ""), http.StatusBadRequest},
		{"out of service", bookingBody(broken.ID, tomorrowAt(10), tomorrowAt(11), ""), http.StatusBadRequest},
		{"missing equipment", bookingBody(9999, tomorrowAt(10), tomorrowAt(11), ""), http.StatusNotFound},
		{"missing times", fmt.Sprintf(`{"EquipmentID": %d}`, equipment.ID), http.StatusBadRequest},
		{"back to back by someone else", bookingBody(equipment.ID, tomorrowAt(12), tomorrowAt(13), ""), http.StatusCreated},
		{"inside working hours", bookingBody(hours.ID, tomorrowAt(9), tomorrowAt(17), ""), http.StatusCreated},
	} {
		t.Run(test.name, func(t *testing.T) {
			requireStatus(t, makeRequest(router, http.MethodPost, "/bookings", test.body, token), test.status)
		})
	}

	// The owner already has 10:00-12:00; 12:00-19:00 would make nine consecutive hours.
	other := newTestEquipment(t, db, bookings.Equipment{})
	if err := db.Create(&bookings.Booking{EquipmentID: other.ID, UserID: owner.ID, Start: tomorrowAt(10).UTC(), End: tomorrowAt(12).UTC()}).Error; err != nil {
		t.Fatal(err)
	}
	requireStatus(t, makeRequest(router, http.MethodPost, "/bookings", bookingBody(other.ID, tomorrowAt(12), tomorrowAt(19), ""), ownerToken), http.StatusBadRequest)
	requireStatus(t, makeRequest(router, http.MethodPost, "/bookings", bookingBody(other.ID, tomorrowAt(12), tomorrowAt(18), ""), ownerToken), http.StatusCreated)
}

func TestGetBookingsMarksOwnBookings(t *testing.T) {
	router, db := newAuthRouter(t)
	owner, ownerToken := newTestSession(t, db)
	_, otherToken := newTestSession(t, db)
	equipment := newTestEquipment(t, db, bookings.Equipment{})
	if err := db.Create(&bookings.Booking{EquipmentID: equipment.ID, UserID: owner.ID, Start: tomorrowAt(10).UTC(), End: tomorrowAt(11).UTC()}).Error; err != nil {
		t.Fatal(err)
	}
	old := time.Now().Add(-72 * time.Hour).UTC()
	if err := db.Create(&bookings.Booking{EquipmentID: equipment.ID, UserID: owner.ID, Start: old, End: old.Add(time.Hour)}).Error; err != nil {
		t.Fatal(err)
	}

	for _, test := range []struct {
		token string
		mine  bool
	}{{ownerToken, true}, {otherToken, false}} {
		response := makeRequest(router, http.MethodGet, "/bookings", "", test.token)
		requireStatus(t, response, http.StatusOK)
		var result struct {
			Bookings []bookings.BookingDTO `json:"bookings"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if len(result.Bookings) != 1 {
			t.Fatalf("Expected only the upcoming booking, got %+v", result.Bookings)
		}
		if result.Bookings[0].Mine != test.mine || result.Bookings[0].UserName != owner.Name {
			t.Errorf("Expected Mine=%v and owner name, got %+v", test.mine, result.Bookings[0])
		}
	}
}

func TestBookingOwnership(t *testing.T) {
	router, db := newAuthRouter(t)
	owner, ownerToken := newTestSession(t, db)
	_, otherToken := newTestSession(t, db, auth.PermissionBookingAdd, auth.PermissionBookingModify, auth.PermissionBookingDelete)
	_, managerToken := newTestSession(t, db, auth.PermissionBookingManage)
	equipment := newTestEquipment(t, db, bookings.Equipment{})
	booking := bookings.Booking{EquipmentID: equipment.ID, UserID: owner.ID, Start: tomorrowAt(10).UTC(), End: tomorrowAt(12).UTC()}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	path := "/bookings/" + strconv.Itoa(booking.ID)

	// Equipment permissions do not cover other people's reservations.
	requireStatus(t, makeRequest(router, http.MethodPut, path, bookingBody(equipment.ID, tomorrowAt(10), tomorrowAt(12), "Taken over"), otherToken), http.StatusForbidden)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", otherToken), http.StatusForbidden)

	// The owner can edit without colliding with the booking's own slot.
	response := makeRequest(router, http.MethodPut, path, bookingBody(equipment.ID, tomorrowAt(11), tomorrowAt(13), "Revised"), ownerToken)
	requireStatus(t, response, http.StatusOK)
	updated := decodeBooking(t, response.Body.Bytes())
	if updated.ID != booking.ID || !updated.Mine || updated.Purpose != "Revised" || !updated.Start.Equal(tomorrowAt(11)) {
		t.Errorf("Unexpected owner update %+v", updated)
	}

	// A booking manager can edit it, and it keeps its owner.
	response = makeRequest(router, http.MethodPut, path, bookingBody(equipment.ID, tomorrowAt(11), tomorrowAt(13), "Admin revision"), managerToken)
	requireStatus(t, response, http.StatusOK)
	updated = decodeBooking(t, response.Body.Bytes())
	if updated.Mine || updated.UserName != owner.Name || updated.Purpose != "Admin revision" {
		t.Errorf("Unexpected manager update %+v", updated)
	}
	var stored bookings.Booking
	if err := db.First(&stored, booking.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.UserID != owner.ID {
		t.Errorf("Expected owner to be kept, got %s", stored.UserID)
	}

	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", managerToken), http.StatusNoContent)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", ownerToken), http.StatusNotFound)
	requireStatus(t, makeRequest(router, http.MethodPut, path, bookingBody(equipment.ID, tomorrowAt(11), tomorrowAt(13), ""), ownerToken), http.StatusNotFound)
}
