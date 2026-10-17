package handler

import (
	"net/http"

	"github.com/evaan/unnamed-inventory-manager/Inventory-Server/util"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetItemByID(c *gin.Context, db *gorm.DB) {
	id := c.Param("id")

	var item util.Item
	db.First(&item, id)

	c.JSON(http.StatusOK, gin.H{
		"item": item,
	})
}
