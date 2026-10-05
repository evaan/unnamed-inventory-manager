package util

import (
	"uuid"
)

type User struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name              string    `gorm:"not null"`
	Email             string    `gorm:"not null;uniqueIndex"`
	ProfilePictureURL string
}
