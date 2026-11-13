package database

import (
	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
	"github.com/evaandev/unnamed-inventory-manager/settings"
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
