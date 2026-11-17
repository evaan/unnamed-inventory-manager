package inventory

import (
	"net/http"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ModifyItem(c *gin.Context, db *gorm.DB, userId uuid.UUID, item Item, newItem map[string]interface{}, deltaQ int32, action ChangelogAction, description *string) {
	if err := db.Model(&item).Updates(newItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update item",
		})
		return
	}

	log := Changelog{
		UserID:      userId,
		ItemID:      item.ID,
		Quantity:    deltaQ,
		Action:      action,
		ChangeTime:  time.Now(),
		Description: *description}

	if err := db.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create changelog",
		})
		return
	}

	// Return item
	if err := db.First(&item, "id = ?", item.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve updated item",
		})
		return
	}
}
