package main

import (
	"log"
	"net/http"
	"os"

	"github.com/evaan/unnamed-inventory-manager/util"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	db, err := gorm.Open(postgres.Open(os.Getenv("POSTGRES_URL")), &gorm.Config{})
	if err != nil {
		log.Fatalf("Error connecting to database: %s", err)
	}

	db.AutoMigrate(&util.User{})

	router := gin.Default()

	router.Use(cors.Default())

	err = router.SetTrustedProxies([]string{
		"127.0.0.1",
		"173.245.48.0/20",
		"103.21.244.0/22",
		"103.22.200.0/22",
		"103.31.4.0/22",
		"141.101.64.0/18",
		"108.162.192.0/18",
		"190.93.240.0/20",
		"188.114.96.0/20",
		"197.234.240.0/22",
		"198.41.128.0/17",
		"162.158.0.0/15",
		"104.16.0.0/13",
		"104.24.0.0/14",
		"172.64.0.0/13",
		"131.0.72.0/22",
	})
	if err != nil {
		log.Fatal(err)
	}

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "API is working"})
	})

	err = router.Run(":8080")
	if err != nil {
		log.Fatal(err)
	}
}
