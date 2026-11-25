package bookings

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Cancel booking
// @Description	Cancels a booking. Allowed for the booking's owner or users with BookingManage
// @Tags			Booking
// @Param			id	path	int	true	"Booking ID"
// @Success		204	"Booking cancelled"
// @Failure		400	"Invalid booking ID"
// @Failure		401	"Not logged in"
// @Failure		403	"Not the owner and missing BookingManage"
// @Failure		404	"Booking not found"
// @Failure		500	"Error cancelling booking"
// @Router			/bookings/{id} [delete]
func CancelBooking(c *gin.Context, db *gorm.DB) {
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

	var booking Booking
	if err := db.First(&booking, "id = ?", id).Error; err != nil {
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
			"error": "You can only cancel your own bookings.",
		})
		return
	}

	if err := db.Delete(&Booking{}, "id = ?", booking.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to cancel booking",
		})
		return
	}

	c.Status(http.StatusNoContent)
}
