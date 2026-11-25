package bookings

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// @Summary		Update booking
// @Description	Changes a booking's equipment, time or purpose. Allowed for the booking's owner or users with BookingManage. The booking keeps its owner and follows the same rules as a new booking
// @Tags			Booking
// @Accept			json
// @Produce		json
// @Param			id		path		int			true	"Booking ID"
// @Param			body	body		BookingReq	true	"Equipment, start and end time (RFC 3339) and purpose"
// @Success		200		{object}	object{booking=BookingDTO}	"Booking updated"
// @Failure		400		"Invalid booking ID or request body, or the slot breaks a booking rule"
// @Failure		401		"Not logged in"
// @Failure		403		"Not the owner and missing BookingManage"
// @Failure		404		"Booking or equipment not found"
// @Failure		409		"The slot overlaps an existing booking"
// @Failure		500		"Error updating booking"
// @Router			/bookings/{id} [put]
func UpdateBooking(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())
	user, err := auth.GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid booking ID",
		})
		return
	}

	req, ok := bindBooking(c)
	if !ok {
		return
	}

	var booking Booking
	if err := db.Preload("User").First(&booking, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Booking not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve booking",
		})
		return
	}

	allowed, err := canManageBooking(db, user, booking)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "You can only modify your own bookings.",
		})
		return
	}

	booking.EquipmentID = req.EquipmentID
	booking.Start = req.Start
	booking.End = req.End
	booking.Purpose = req.Purpose

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := validateSlot(tx, req, booking, booking.ID); err != nil {
			return err
		}
		return tx.Omit(clause.Associations).Save(&booking).Error
	})
	if err != nil {
		writeTxError(c, err, "Failed to update booking")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"booking": toBookingDTO(booking, user),
	})
}
