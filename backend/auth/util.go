package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func GetUser(c *gin.Context) (*User, error) {
	u, exists := c.Get("user")
	if !exists || u == nil {
		return nil, errors.New("user not authenticated")
	}

	user, ok := u.(*User)
	if !ok || user == nil {
		return nil, errors.New("invalid user in context")
	}

	return user, nil
}

func IsAdmin(db *gorm.DB, user *User) (bool, error) {
	var isAdmin bool

	err := db.Model(&UserPermission{}).
		Joins("JOIN users ON users.id = user_permissions.user_id").
		Select("COUNT(*) > 0").
		Where("user_permissions.user_id = ? AND permission = ? AND users.disabled = ?", user.ID, PermissionAdministrator, false).
		Scan(&isAdmin).Error

	return isAdmin, err
}

func DoesUserExist(db *gorm.DB, userID string) (bool, error) {
	var count int64

	err := db.Model(&User{}).
		Where("id = ?", userID).
		Count(&count).Error

	return count > 0, err
}

func GetUserPermissions(db *gorm.DB, userID uuid.UUID) ([]string, error) {
	permissions := make([]string, 0)
	err := db.Model(&UserPermission{}).Where("user_id = ?", userID).
		Order("permission").Pluck("permission", &permissions).Error
	return permissions, err
}

func SetCookie(c *gin.Context, name, value string, maxAge int) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(name, value, maxAge, "/", "", c.GetBool("secureCookies"), true)
}

func lockPermissions(db *gorm.DB) error {
	return db.Exec("SELECT pg_advisory_xact_lock(?)", int64(740461835)).Error
}

func DeleteExpired(db *gorm.DB) error {
	now := time.Now()
	return errors.Join(
		db.Where("expires <= ?", now).Delete(&UserSession{}).Error,
		db.Where("expires <= ?", now).Delete(&OAuthState{}).Error,
	)
}
