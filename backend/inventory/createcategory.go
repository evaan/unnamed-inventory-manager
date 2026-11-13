package inventory

import (
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Add item category
// @Description	Adds a category for items to the inventory manager
// @Tags			Category
// @Accept			json
// @Param			body	body	CreateItemCategoryReq	true	"Category information (categoryName, parentID)"
// @Success		201		"Item category created"
// @Failure		400		"Invalid request body"
// @Failure		500		"Error creating category"
// @Router			/categories [post]
func CreateCategory(c *gin.Context, db *gorm.DB) {

	var req CreateItemCategoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	newCategory := ItemCategory{
		ID:           uuid.New(),
		CategoryName: req.CategoryName,
		ParentID:     req.ParentID,
	}

	if err := db.Create(&newCategory).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create category",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"itemCategory": newCategory,
	})
}
