package util

import (
	"time"

	"github.com/google/uuid"
)

type Item struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey"`
	ItemName         string     `gorm:"not null"`
	ParentID         *uuid.UUID `gorm:"type:uuid;not null"`
	Quantity         int32      `gorm:"type:integer;not null"`
	Manufacturer     string     `gorm:"not null"`
	ManufacturerPart string     `gorm:"not null"`
	DistributorPart  string     // Digikey or McMaster part number
	DistributorURL   string
	DataSheetURL     string
	Description      string
}

type Changelog struct {
	ID          int             `gorm:"primaryKey;autoIncrement"`
	UserID      uuid.UUID       `gorm:"type:uuid;not null"`
	ItemID      uuid.UUID       `gorm:"type:uuid;not null"`
	Item        Item            `gorm:foreignKey:ItemID;references:ID;constraint:OnDelete:RESTRICT"`
	Quantity    int16           `gorm:"type:int;not null"` // change to quantity
	Action      ChangelogAction `gorm:"type:varchar(20);not null"`
	ChangeTime  time.Time       `gorm:"not null"`
	Description string
}
