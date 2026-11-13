package auth

import (
	"errors"
	"os"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateLoginSession(db *gorm.DB, googleID, name, email string) (string, error) {
	sessionToken := GenerateToken()
	adminEmail := os.Getenv("ADMIN_EMAIL")
	isAdminEmail := adminEmail != "" && email == adminEmail

	err := db.Transaction(func(tx *gorm.DB) error {
		var user User
		err := tx.Where("google_id = ?", googleID).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			var disabled bool
			if !isAdminEmail {
				disabled, err = newUserDisabled(tx, email)
				if err != nil {
					return err
				}
			}

			user = User{ID: uuid.New(), Name: name, Email: email, GoogleID: googleID, Disabled: disabled}
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		if !user.Disabled && isAdminEmail {
			var count int64
			if err := tx.Model(&UserPermission{}).
				Where("permission = ?", PermissionAdministrator).
				Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				if err := tx.Create(&UserPermission{UserID: user.ID, Permission: PermissionAdministrator}).Error; err != nil {
					return err
				}
			}
		}

		return tx.Create(&UserSession{
			UserID: user.ID, SessionToken: HashToken(sessionToken), Expires: time.Now().Add(8 * time.Hour),
		}).Error
	})
	if err != nil {
		return "", err
	}

	return sessionToken, nil
}
