package inventory

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get all Categories
// @Description	Gets information for all categories
// @Tags			Category
// @Accept			json
// @Success		200		"Category information retrieved"
// @Failure		500		"Error retrieving categories"
// @Router			/categories [get]
func GetCategories(c *gin.Context, db *gorm.DB) {

	var categories []ItemCategory

	if err := db.Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving item categories",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"itemCategories": categories,
	})

}
