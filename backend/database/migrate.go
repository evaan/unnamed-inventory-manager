package database

import (
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/inventory"
	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&auth.User{}, &auth.UserPermission{}, &auth.UserSession{}, &inventory.Item{}, &inventory.Changelog{})
}
