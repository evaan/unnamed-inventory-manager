package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

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

func PutPermissions(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())
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

	actor, err := GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	permissions := make([]UserPermission, 0, len(req.Permissions))
	seen := make(map[string]bool, len(req.Permissions))

	for _, permission := range req.Permissions {
		if permission != PermissionAdministrator || seen[permission] {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		seen[permission] = true
		permissions = append(permissions, UserPermission{
			UserID:     userID,
			Permission: permission,
		})
	}

	status := http.StatusInternalServerError
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := lockPermissions(tx); err != nil {
			return err
		}
		isAdmin, err := IsAdmin(tx, actor)
		if err != nil {
			return err
		}
		if !isAdmin {
			status = http.StatusForbidden
			return errors.New("administrator permission required")
		}
		exists, err := DoesUserExist(tx, userID.String())
		if err != nil {
			return err
		}
		if !exists {
			status = http.StatusNotFound
			return gorm.ErrRecordNotFound
		}
		if err := tx.Where("user_id = ?", userID).
			Delete(&UserPermission{}).Error; err != nil {
			return err
		}

		if len(permissions) > 0 {
			if err := tx.Create(&permissions).Error; err != nil {
				return err
			}
		}

		var administrators int64
		if err := tx.Model(&UserPermission{}).
			Joins("JOIN users ON users.id = user_permissions.user_id").
			Where("permission = ? AND users.disabled = ?", PermissionAdministrator, false).
			Count(&administrators).Error; err != nil {
			return err
		}
		if administrators == 0 {
			status = http.StatusConflict
			return errors.New("cannot remove the last enabled administrator")
		}

		return nil
	})
	if err != nil {
		c.AbortWithError(status, err)
		return
	}

	c.Status(http.StatusNoContent)
}
