package inventory

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get changelog
// @Description	Gets all logs saved from changes to the inventory
// @Tags			Item
// @Accept			json
// @Success		200		"Log information retrieved"
// @Failure		500		"Error retrieving logs"
// @Router			/logs [get]
func GetLogs(c *gin.Context, db *gorm.DB) {
	// TODO: add pagination and DTO
	var logs []Changelog

	if err := db.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving log information",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": logs,
	})
}
