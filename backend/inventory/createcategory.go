package inventory

import (
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

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
