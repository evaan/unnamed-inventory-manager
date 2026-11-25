package bookings

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Add equipment
// @Description	Adds bookable equipment. Requires BookingAdd
// @Tags			Booking
// @Accept			json
// @Produce		json
// @Param			body	body		EquipmentReq	true	"Equipment details. Missing hours use the category default"
// @Success		201		{object}	object{equipment=Equipment}	"Equipment created"
// @Failure		400		"Invalid request body"
// @Failure		403		"Missing BookingAdd permission"
// @Failure		500		"Error creating equipment"
// @Router			/equipment [post]
func CreateEquipment(c *gin.Context, db *gorm.DB) {
	var req EquipmentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	equipment, err := equipmentFromRequest(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if err := db.WithContext(c.Request.Context()).Create(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create equipment",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"equipment": equipment,
	})
}
