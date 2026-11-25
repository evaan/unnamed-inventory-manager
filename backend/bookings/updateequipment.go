package bookings

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Update equipment
// @Description	Replaces bookable equipment details. Requires BookingModify. Existing bookings are kept
// @Tags			Booking
// @Accept			json
// @Produce		json
// @Param			id		path		int				true	"Equipment ID"
// @Param			body	body		EquipmentReq	true	"Equipment details. Missing hours use the category default"
// @Success		200		{object}	object{equipment=Equipment}	"Equipment updated"
// @Failure		400		"Invalid equipment ID or request body"
// @Failure		403		"Missing BookingModify permission"
// @Failure		404		"Equipment not found"
// @Failure		500		"Error updating equipment"
// @Router			/equipment/{id} [put]
func UpdateEquipment(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid equipment ID",
		})
		return
	}

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

	var existing Equipment
	if err := db.First(&existing, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Equipment not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve equipment",
		})
		return
	}

	equipment.ID = existing.ID
	if err := db.Save(&equipment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update equipment",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"equipment": equipment,
	})
}
