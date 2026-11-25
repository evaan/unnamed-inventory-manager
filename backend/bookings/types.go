package bookings

import (
	"time"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/google/uuid"
)

const (
	DefaultOpenHour  = 8
	DefaultCloseHour = 20
	MaxBookingHours  = 8
	BookingDays      = 7
)

type EquipmentStatus string

const (
	EquipmentActive      EquipmentStatus = "ACTIVE"
	EquipmentMaintenance EquipmentStatus = "MAINTENANCE"
)

type Equipment struct {
	ID              int    `gorm:"primaryKey;autoIncrement"`
	Name            string `gorm:"not null"`
	Category        string `gorm:"not null"`
	Location        string `gorm:"not null"`
	Description     string
	Status          EquipmentStatus `gorm:"type:varchar(20);not null"`
	MaintenanceNote string
	OpenHour        int    `gorm:"not null"` // local hour the equipment opens, 0-23
	CloseHour       int    `gorm:"not null"` // local hour the equipment closes, 1-24
	Icon            string `gorm:"not null;default:''"`
}

type Booking struct {
	ID          int       `gorm:"primaryKey;autoIncrement"`
	EquipmentID int       `gorm:"not null;index"`
	Equipment   Equipment `gorm:"foreignKey:EquipmentID;references:ID;constraint:OnDelete:CASCADE"`
	UserID      uuid.UUID `gorm:"type:uuid;not null;index"`
	User        auth.User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	Start       time.Time `gorm:"column:start_time;not null;index"`
	End         time.Time `gorm:"column:end_time;not null;index"`
	Purpose     string
}

// EquipmentReq is the body for creating or replacing equipment. Missing hours use the category default.
type EquipmentReq struct {
	Name            string          `json:"Name" binding:"required"`
	Category        string          `json:"Category" binding:"required"`
	Location        string          `json:"Location" binding:"required"`
	Description     string          `json:"Description"`
	Status          EquipmentStatus `json:"Status" binding:"required"`
	MaintenanceNote string          `json:"MaintenanceNote"`
	OpenHour        *int            `json:"OpenHour"`
	CloseHour       *int            `json:"CloseHour"`
	Icon            string          `json:"Icon"`
}

var validIcons = map[string]bool{
	"":       true, // no choice: the frontend falls back to the category icon
	"wrench": true, "printer": true, "scissors": true,
	"hammer": true, "zap": true, "cpu": true,
}

func (r EquipmentReq) IconValid() bool { return validIcons[r.Icon] }

// BookingReq is the body for creating or updating a booking. The owner always comes from the session.
type BookingReq struct {
	EquipmentID int       `json:"EquipmentID" binding:"required"`
	Start       time.Time `json:"Start" binding:"required"`
	End         time.Time `json:"End" binding:"required"`
	Purpose     string    `json:"Purpose"`
}

// BookingDTO is the booking shape the frontend expects. Mine is worked out from the session.
type BookingDTO struct {
	ID          int
	EquipmentID int
	UserName    string
	Mine        bool
	Start       time.Time
	End         time.Time
	Purpose     string
}

func toBookingDTO(booking Booking, user *auth.User) BookingDTO {
	return BookingDTO{
		ID:          booking.ID,
		EquipmentID: booking.EquipmentID,
		UserName:    booking.User.Name,
		Mine:        booking.UserID == user.ID,
		Start:       booking.Start,
		End:         booking.End,
		Purpose:     booking.Purpose,
	}
}
