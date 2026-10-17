package handler

import (
	"net/http"

	"github.com/evaan/unnamed-inventory-manager/Inventory-Server/util"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetItems(c *gin.Context, db *gorm.DB) {
	var items []util.Item

	db.Find(&items)

	c.JSON(http.StatusOK, gin.H{
		"items": items,
	})
}
