package inventory

import (
	"errors"
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get category
// @Description	Gets information for one category
// @Tags			Category
// @Accept			json
// @Param			id		path	string				true	"Item Category ID"	Format(uuid)
// @Success		200		"Category retrieved"
// @Failure		400		"Invalid category ID"
// @Failure		404		"Category not found"
// @Failure		500		"Error retrieving item category"
// @Router			/categories/{id} [get]
func GetCategoryByID(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")

	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No category selected",
		})
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category ID",
		})
		return
	}

	var category ItemCategory
	if err := db.First(&category, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Category not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve category",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"itemCategory": category,
	})
}
