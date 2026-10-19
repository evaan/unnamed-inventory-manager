package auth

import (
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
