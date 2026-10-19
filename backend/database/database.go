package database

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect() (*gorm.DB, error) {
	return gorm.Open(postgres.Open(os.Getenv("POSTGRES_URL")), &gorm.Config{
		TranslateError: true,
		Logger: logger.New(log.New(os.Stdout, "", log.LstdFlags), logger.Config{
			LogLevel: logger.Warn, SlowThreshold: 200 * time.Millisecond,
			IgnoreRecordNotFoundError: true, ParameterizedQueries: true,
		}),
	})
}
