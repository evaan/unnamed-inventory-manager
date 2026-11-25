package bookings

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Delete equipment
// @Description	Deletes bookable equipment and all of its bookings. Requires BookingDelete
// @Tags			Booking
// @Param			id	path	int	true	"Equipment ID"
// @Success		204	"Equipment deleted"
// @Failure		400	"Invalid equipment ID"
// @Failure		403	"Missing BookingDelete permission"
// @Failure		404	"Equipment not found"
// @Failure		500	"Error deleting equipment"
// @Router			/equipment/{id} [delete]
func DeleteEquipment(c *gin.Context, db *gorm.DB) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid equipment ID",
		})
		return
	}

	err = db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("equipment_id = ?", id).Delete(&Booking{}).Error; err != nil {
			return err
		}

		result := tx.Delete(&Equipment{}, "id = ?", id)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Equipment not found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete equipment",
		})
		return
	}

	c.Status(http.StatusNoContent)
}
