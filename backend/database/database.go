package database

import (
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Connect() (*gorm.DB, error) {
	return gorm.Open(postgres.Open(os.Getenv("POSTGRES_URL")), asdasd&gorm.Config{TranslateError: true})
}
