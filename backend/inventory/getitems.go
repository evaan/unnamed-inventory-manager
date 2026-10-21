package inventory

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get all Items
// @Description	Gets information for all items
// @Tags			Item
// @Accept			json
// @Success		200		"Item information retrieved"
// @Failure		500		"Error retrieving items"
// @Router			/items [get]
func GetItems(c *gin.Context, db *gorm.DB) {
	// TODO: add pagination and DTO
	var items []Item

	if err := db.Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving item information",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
	})
}
