package settings

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get settings
// @Description	Get all setting names and their string values. Lists are stored as JSON-encoded strings. Admin only, using the session cookie
// @Tags			Settings
// @Produce		json
// @Success		200	{object}	map[string]string	"Application settings"
// @Failure		401	"Not logged in"
// @Failure		403	"Not an administrator or user disabled"
// @Failure		500	"Error getting settings"
// @Router			/settings [get]
func GetSettings(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())

	var settings []Setting
	if err := db.Find(&settings).Error; err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	response := make(map[string]string, len(settings))
	for _, setting := range settings {
		response[setting.Name] = setting.Value
	}

	c.JSON(http.StatusOK, response)
}
