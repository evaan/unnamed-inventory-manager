package bookings

import (
	"net/http"
	"time"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get bookings
// @Description	Get current and upcoming bookings for all equipment, plus bookings that ended in the last 24 hours. Mine is true for the logged-in user's bookings
// @Tags			Booking
// @Produce		json
// @Success		200	{object}	object{bookings=[]BookingDTO}	"Bookings"
// @Failure		401	"Not logged in"
// @Failure		500	"Error retrieving bookings"
// @Router			/bookings [get]
func GetBookings(c *gin.Context, db *gorm.DB) {
	user, err := auth.GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var bookings []Booking
	if err := db.WithContext(c.Request.Context()).
		Preload("User").
		Where("end_time > ?", time.Now().UTC().Add(-24*time.Hour)).
		Order("start_time").
		Find(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving bookings",
		})
		return
	}

	result := make([]BookingDTO, 0, len(bookings))
	for _, booking := range bookings {
		result = append(result, toBookingDTO(booking, user))
	}

	c.JSON(http.StatusOK, gin.H{
		"bookings": result,
	})
}
