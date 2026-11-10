package settings

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Update settings
// @Description	Update existing settings by name. Values must be strings; encode lists as JSON strings. Omitted settings are unchanged.
// @Description	All updates are applied together, and unknown names are rejected. Admin only, using the session cookie
// @Tags			Settings
// @Accept			json
// @Param			body	body	PatchSettingsRequest	true	"Setting names mapped to string values"
// @Param			Origin	header	string	false	"Frontend origin, required if Referer is not set"
// @Success		204	"Settings updated"
// @Failure		400	"Invalid request body, non-string value, or no settings provided"
// @Failure		401	"Not logged in"
// @Failure		403	"Not an administrator, user disabled, or invalid frontend Origin or Referer"
// @Failure		404	"Setting not found"
// @Failure		500	"Error updating settings"
// @Router			/settings [patch]
func PatchSettings(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())

	var req PatchSettingsRequest
	decoder := json.NewDecoder(c.Request.Body)
	if err := decoder.Decode(&req); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if len(req) == 0 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	names := make([]string, 0, len(req))
	for name, value := range req {
		if value == nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		names = append(names, name)
	}
	sort.Strings(names)

	err := db.Transaction(func(tx *gorm.DB) error {
		for _, name := range names {
			result := tx.Model(&Setting{}).
				Where("name = ?", name).
				Update("value", *req[name])
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
		}

		return nil
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.Status(http.StatusNoContent)
}
