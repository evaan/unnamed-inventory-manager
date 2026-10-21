package inventory

import (
	"errors"
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get item
// @Description	Gets full information for one item
// @Tags			Item
// @Accept			json
// @Param			id		path	string				true	"Item ID"	Format(uuid)
// @Success		200		"Item retrieved"
// @Failure		400		"Invalid item ID"
// @Failure		404		"Item not found"
// @Failure		500		"Error retrieving item"
// @Router			/items/{id} [get]
func GetItemByID(c *gin.Context, db *gorm.DB) {
	// TODO: make this support stuff in request body like name
	id := c.Param("id")

	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No item selected",
		})
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid item ID",
		})
		return
	}

	var item Item
	if err := db.First(&item, "id = ?", id).Error; err != nil {
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

	c.JSON(http.StatusOK, gin.H{
		"item": item,
	})
}
