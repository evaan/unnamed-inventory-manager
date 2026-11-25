package bookings

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get equipment
// @Description	Get all bookable equipment
// @Tags			Booking
// @Produce		json
// @Success		200	{object}	object{equipment=[]Equipment}	"Bookable equipment"
// @Failure		401	"Not logged in"
// @Failure		500	"Error retrieving equipment"
// @Router			/equipment [get]
func GetEquipment(c *gin.Context, db *gorm.DB) {
	equipment := []Equipment{}
	if err := db.WithContext(c.Request.Context()).Order("id").Find(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving equipment",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"equipment": equipment,
	})
}
