package inventory

import (
	"time"
	"uuid"
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
	Item        Item            `gorm:"foreignKey:ItemID;references:ID;constraint:OnDelete:RESTRICT"`
	Quantity    int32           `gorm:"type:int;not null"` // change to quantity
	Action      ChangelogAction `gorm:"type:varchar(20);not null"`
	ChangeTime  time.Time       `gorm:"not null"`
	Description string
}

type UpdateItemReq struct {
	ItemName         *string `json:"itemName"`
	Quantity         *int32  `json:"quantity"`
	Manufacturer     *string `json:"manufacturer"`
	ManufacturerPart *string `json:"manufacturerPart"`
	DistributorPart  *string `json:"distributorPart"`
	DistributorURL   *string `json:"distributorURL"`
	ItemDescription  *string `json:"itemDescription"`
	DataSheetURL     *string `json:"dataSheetURL"`
	LogDescription   *string `json:"logDescription"`
}

type ItemDTO struct {
	ItemName     string     `gorm:"not null"`
	ParentID     *uuid.UUID `gorm:"type:uuid;not null"`
	Quantity     int32      `gorm:"type:integer;not null"`
	Manufacturer string     `gorm:"not null"`
}

type ChangelogAction string

const (
	ItemCreated  ChangelogAction = "CREATE"
	ItemTaken    ChangelogAction = "TAKEN"
	ItemAdded    ChangelogAction = "ADDED"
	ItemModified ChangelogAction = "MODIFIED"
	ItemDeleted  ChangelogAction = "DELETE"
)
