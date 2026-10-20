package inventory

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TODO: add pagination and DTO
func GetItems(c *gin.Context, db *gorm.DB) {
	var items []Item

	db.Find(&items)

	c.JSON(http.StatusOK, gin.H{
		"items": items,
	})
}
