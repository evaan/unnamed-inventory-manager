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
	// Keep the existing log fields, adding only the user's display name.
	logs := make([]struct {
		Changelog
		UserName string
	}, 0)

	if err := db.WithContext(c.Request.Context()).
		Model(&Changelog{}).
		Select("changelogs.*, users.name AS user_name").
		Joins("LEFT JOIN users ON users.id = changelogs.user_id").
		Preload("Item", func(query *gorm.DB) *gorm.DB { return query.Unscoped() }).
		Order("changelogs.change_time DESC, changelogs.id DESC").
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving log information",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": logs,
	})
}
