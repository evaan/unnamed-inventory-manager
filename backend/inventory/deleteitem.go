package inventory

import (
	"errors"
	"net/http"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TODO: create req object with log description
// TODO: add real uuid for User
func DeleteItem(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")

	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No item selected",
		})
		return
	}

	itemid, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid item ID",
		})
		return
	}

	var item Item
	if err := db.First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Item not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve item",
		})
		return
	}
	quantity := item.Quantity * (-1)

	if err := db.Delete(&item, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete item",
		})
		return
	}

	// add to changelog
	action := ItemDeleted

	// TODO: create req object with log description
	logdescription := ""
	// TODO: add real uuid for User
	log := Changelog{
		UserID:      uuid.New(),
		ItemID:      itemid,
		Quantity:    quantity,
		Action:      action,
		ChangeTime:  time.Now(),
		Description: logdescription}

	if err := db.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create changelog",
		})
		return
	}
	c.JSON(http.StatusNoContent, gin.H{})
}
