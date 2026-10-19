package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// @Summary		Get your permissions
// @Description	Uses the session cookie to get your permissions. Must be logged in
// @Tags			Auth
// @Produce		json
// @Success		200	{array}	string	"Current user's permissions"
// @Failure		401	"Not logged in"
// @Failure		500	"Error getting permissions"
// @Router			/permissions [get]
func GetPermissions(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())
	user, err := GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	permissions, err := GetUserPermissions(db, user.ID)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, permissions)
}

// @Summary		Get a user's permissions
// @Description	Get permissions by user ID. Admin only, using the session cookie
// @Tags			Auth
// @Produce		json
// @Param			id	path	string	true	"User ID"	Format(uuid)
// @Success		200	{array}	string	"User's permissions"
// @Failure		400	"Invalid user ID"
// @Failure		401	"Not logged in"
// @Failure		403	"Not an administrator"
// @Failure		404	"User not found"
// @Failure		500	"Error getting permissions"
// @Router			/permissions/{id} [get]
func GetPermissionsFromId(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	exists, err := DoesUserExist(db, userID.String())
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	if !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	permissions, err := GetUserPermissions(db, userID)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, permissions)
}

// @Summary		Replace a user's permissions
// @Description	Replace the user's permissions, or send an empty list to clear them. Admin only, using the session cookie
// @Tags			Auth
// @Accept			json
// @Param			id		path	string					true	"User ID"	Format(uuid)
// @Param			body	body	PutPermissionsRequest	true	"User permissions"
// @Param			Origin	header	string					false	"Frontend origin, required if Referer is not set"
// @Success		204		"Permissions updated"
// @Failure		400		"Invalid user ID or request body"
// @Failure		401		"Not logged in"
// @Failure		403		"Not an administrator or invalid frontend Origin or Referer"
// @Failure		404		"User not found"
// @Failure		500		"Error updating permissions"
// @Router			/permissions/{id} [put]
func PutPermissions(c *gin.Context, db *gorm.DB) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var req PutPermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	exists, err := DoesUserExist(db, userID.String())
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	if !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	permissions := make([]UserPermission, 0, len(req.Permissions))
	for _, permission := range req.Permissions {
		permissions = append(permissions, UserPermission{
			UserID:     userID,
			Permission: permission,
		})
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userID).
			Delete(&UserPermission{}).Error; err != nil {
			return err
		}

		if len(permissions) > 0 {
			if err := tx.Create(&permissions).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.Status(http.StatusNoContent)
}
