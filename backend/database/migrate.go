package database

import (
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/inventory"
	"gitlab.com/evaandev/unnamed-inventory-manager/settings"
	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&auth.User{}, &auth.UserPermission{}, &auth.UserSession{},
		&inventory.Item{}, &inventory.Changelog{}, &settings.Setting{},
	); err != nil {
		return err
	}

	return settings.SeedDefaults(db)
}
