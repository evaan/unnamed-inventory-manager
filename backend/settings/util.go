package settings

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func SeedDefaults(db *gorm.DB) error {
	defaults := []Setting{
		{Name: SignupPolicy, Value: "whitelist"}, // Possible options: open, whitelist, closed
		{Name: WhitelistedEmailDomains, Value: `["mun.ca"]`},
	}

	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&defaults).Error
}

func Get(db *gorm.DB, name string) (string, error) {
	var setting Setting
	err := db.Where("name = ?", name).First(&setting).Error
	return setting.Value, err
}

func Set(db *gorm.DB, name, value string) error {
	setting := Setting{Name: name, Value: value}
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "name"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(&setting).Error
}
