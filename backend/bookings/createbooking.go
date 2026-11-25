package bookings

import (
	"net/http"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// @Summary		Book equipment
// @Description	Books equipment for the logged-in user. The slot must be in the future, within the next 7 days and the equipment's working hours, at most 8 hours (including back-to-back bookings by the same user), and must not overlap another booking
// @Tags			Booking
// @Accept			json
// @Produce		json
// @Param			body	body		BookingReq	true	"Equipment, start and end time (RFC 3339) and purpose"
// @Success		201		{object}	object{booking=BookingDTO}	"Booking created"
// @Failure		400		"Invalid request body, or the slot breaks a booking rule"
// @Failure		401		"Not logged in"
// @Failure		404		"Equipment not found"
// @Failure		409		"The slot overlaps an existing booking"
// @Failure		500		"Error creating booking"
// @Router			/bookings [post]
func CreateBooking(c *gin.Context, db *gorm.DB) {
	user, err := auth.GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	req, ok := bindBooking(c)
	if !ok {
		return
	}

	booking := Booking{
		EquipmentID: req.EquipmentID,
		UserID:      user.ID,
		Start:       req.Start,
		End:         req.End,
		Purpose:     req.Purpose,
	}

	err = db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := validateSlot(tx, req, booking, 0); err != nil {
			return err
		}
		return tx.Omit(clause.Associations).Create(&booking).Error
	})
	if err != nil {
		writeTxError(c, err, "Failed to create booking")
		return
	}

	booking.User = *user
	c.JSON(http.StatusCreated, gin.H{
		"booking": toBookingDTO(booking, user),
	})
}
