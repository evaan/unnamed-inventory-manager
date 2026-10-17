package util

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name              string    `gorm:"not null"`
	Email             string    `gorm:"not null;uniqueIndex"`
	ProfilePictureURL string
}

type UserSession struct {
	ID           int       `gorm:"primaryKey;autoIncrement"`
	User         User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index"`
	SessionToken string    `gorm:"not null;uniqueIndex"`
	Expires      time.Time `gorm:"not null"`
}

type UserPermission struct {
	ID         int       `gorm:"primaryKey;autoIncrement"`
	User       User      `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_permission"`
	Permission string    `gorm:"not null;uniqueIndex:idx_user_permission"`
}
