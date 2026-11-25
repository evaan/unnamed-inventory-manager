package bookings

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// requestError carries an HTTP status out of a transaction.
type requestError struct {
	status  int
	message string
}

func (e *requestError) Error() string { return e.message }

// writeTxError sends a requestError as is and anything else as a 500 with fallback.
func writeTxError(c *gin.Context, err error, fallback string) {
	var reqErr *requestError
	if errors.As(err, &reqErr) {
		c.JSON(reqErr.status, gin.H{
			"error": reqErr.message,
		})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{
		"error": fallback,
	})
}

// canManageBooking allows the booking's owner, or anyone with BookingManage.
func canManageBooking(db *gorm.DB, user *auth.User, booking Booking) (bool, error) {
	if booking.UserID == user.ID {
		return true, nil
	}
	return auth.HasPermission(db, user, auth.PermissionBookingManage)
}

// validateSlot locks the equipment row, so bookings for one piece of equipment are checked
// one at a time, then checks the slot against nearby bookings. excludeID skips the booking
// being edited (0 for a new booking).
func validateSlot(tx *gorm.DB, req BookingReq, owner Booking, excludeID int) error {
	var equipment Equipment
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&equipment, "id = ?", req.EquipmentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &requestError{http.StatusNotFound, "Equipment not found"}
		}
		return err
	}

	// Only bookings within MaxBookingHours of the slot can overlap it or join a consecutive run that matters.
	margin := MaxBookingHours * time.Hour
	var others []Booking
	if err := tx.Where("equipment_id = ? AND id <> ? AND end_time >= ? AND start_time <= ?",
		equipment.ID, excludeID, req.Start.Add(-margin), req.End.Add(margin)).
		Find(&others).Error; err != nil {
		return err
	}

	if err := bookingError(equipment, others, owner.UserID, req.Start, req.End, time.Now()); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, errOverlap) {
			status = http.StatusConflict
		}
		return &requestError{status, err.Error()}
	}
	return nil
}

// bindBooking reads a BookingReq and normalises its times to UTC.
func bindBooking(c *gin.Context) (BookingReq, bool) {
	var req BookingReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return req, false
	}
	req.Start = req.Start.UTC()
	req.End = req.End.UTC()
	req.Purpose = strings.TrimSpace(req.Purpose)
	return req, true
}
