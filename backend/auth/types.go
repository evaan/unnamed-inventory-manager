package auth

import (
	"time"

	"github.com/google/uuid"
)

const PermissionAdministrator = "Administrator"

type User struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name              string    `gorm:"not null"`
	Email             string    `gorm:"not null;uniqueIndex"`
	ProfilePictureURL string
	GoogleID          string `gorm:"uniqueIndex;not null" json:"-"`
	Disabled          bool   `gorm:"not null;default:false"`
}

type UserSession struct {
	ID           int       `gorm:"primaryKey;autoIncrement"`
	User         User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index"`
	SessionToken string    `gorm:"not null;uniqueIndex" json:"-"`
	Expires      time.Time `gorm:"not null;index"`
}

type OAuthState struct {
	StateHash    string    `gorm:"primaryKey;size:64" json:"-"`
	CodeVerifier string    `gorm:"not null" json:"-"`
	Expires      time.Time `gorm:"not null;index"`
}

type UserPermission struct {
	ID         int       `gorm:"primaryKey;autoIncrement"`
	User       User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_permission"`
	Permission string    `gorm:"not null;uniqueIndex:idx_user_permission"`
}

type PutPermissionsRequest struct {
	Permissions []string `json:"permissions" binding:"required"`
}
