package bookings

import (
	"errors"
	"fmt"
	"strings"
	"time"
	_ "time/tzdata" // lets TZ select the bookings time zone on images without tzdata

	"github.com/google/uuid"
)

// Booking rules mirror frontend/src/features/bookings/bookingTime.ts. Working hours and the
// seven-day window use the server's local time zone (set with the TZ environment variable).

var errOverlap = errors.New("That time overlaps an existing booking.")

func defaultHours(category string) (int, int) {
	if strings.TrimSpace(category) == "3D printers" {
		return 0, 24
	}
	return DefaultOpenHour, DefaultCloseHour
}

// equipmentFromRequest trims and checks the request and fills in default working hours.
func equipmentFromRequest(req EquipmentReq) (Equipment, error) {
	equipment := Equipment{
		Name:        strings.TrimSpace(req.Name),
		Category:    strings.TrimSpace(req.Category),
		Location:    strings.TrimSpace(req.Location),
		Description: strings.TrimSpace(req.Description),
		Status:      req.Status,
		Icon:        req.Icon,
	}
	if equipment.Name == "" || equipment.Category == "" || equipment.Location == "" {
		return equipment, errors.New("Name, category, and location are required.")
	}
	if equipment.Status != EquipmentActive && equipment.Status != EquipmentMaintenance {
		return equipment, errors.New("Invalid equipment status.")
	}
	if equipment.Status == EquipmentMaintenance {
		equipment.MaintenanceNote = strings.TrimSpace(req.MaintenanceNote)
	}
	if !req.IconValid() {
		return equipment, errors.New("Invalid equipment icon.")
	}

	equipment.OpenHour, equipment.CloseHour = defaultHours(equipment.Category)
	if req.OpenHour != nil {
		equipment.OpenHour = *req.OpenHour
	}
	if req.CloseHour != nil {
		equipment.CloseHour = *req.CloseHour
	}
	if equipment.OpenHour < 0 || equipment.CloseHour > 24 || equipment.OpenHour >= equipment.CloseHour {
		return equipment, errors.New("Working hours must use whole hours between 00:00 and 24:00, with closing after opening.")
	}

	return equipment, nil
}

func bookingWindowEnd(now time.Time) time.Time {
	local := now.In(time.Local)
	return time.Date(local.Year(), local.Month(), local.Day()+BookingDays, 0, 0, 0, 0, time.Local)
}

func overlaps(aStart, aEnd, bStart, bEnd time.Time) bool {
	return aStart.Before(bEnd) && bStart.Before(aEnd)
}

// bookingError checks a proposed slot against the equipment and its other bookings.
// others must not include the booking being edited. ownerID is the user the booking belongs to.
func bookingError(equipment Equipment, others []Booking, ownerID uuid.UUID, start, end, now time.Time) error {
	if equipment.Status != EquipmentActive {
		return errors.New("This equipment is out of service.")
	}
	if !end.After(start) {
		return errors.New("End time must be after the start time.")
	}
	if start.Before(now) {
		return errors.New("That start time is in the past.")
	}
	windowEnd := bookingWindowEnd(now)
	if !start.Before(windowEnd) || end.After(windowEnd) {
		return fmt.Errorf("Bookings are limited to the next %d days.", BookingDays)
	}
	if end.Sub(start) > MaxBookingHours*time.Hour {
		return fmt.Errorf("Bookings can be at most %d hours.", MaxBookingHours)
	}
	if equipment.OpenHour != 0 || equipment.CloseHour != 24 {
		local := start.In(time.Local)
		opens := time.Date(local.Year(), local.Month(), local.Day(), equipment.OpenHour, 0, 0, 0, time.Local)
		closes := time.Date(local.Year(), local.Month(), local.Day(), equipment.CloseHour, 0, 0, 0, time.Local)
		if start.Before(opens) || end.After(closes) {
			return fmt.Errorf("Bookings must be between %02d:00 and %02d:00.", equipment.OpenHour, equipment.CloseHour)
		}
	}

	for _, other := range others {
		if other.EquipmentID == equipment.ID && overlaps(start, end, other.Start, other.End) {
			return errOverlap
		}
	}

	// Back-to-back reservations by the same user must not bypass the consecutive-use limit.
	from, to := start, end
	for changed := true; changed; {
		changed = false
		for _, other := range others {
			if other.EquipmentID != equipment.ID || other.UserID != ownerID {
				continue
			}
			if !other.Start.After(to) && !other.End.Before(from) && (other.Start.Before(from) || other.End.After(to)) {
				if other.Start.Before(from) {
					from = other.Start
				}
				if other.End.After(to) {
					to = other.End
				}
				changed = true
			}
		}
	}
	if to.Sub(from) > MaxBookingHours*time.Hour {
		return fmt.Errorf("You can book equipment for at most %d consecutive hours.", MaxBookingHours)
	}

	return nil
}
