package main

import (
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/evaan/unnamed-inventory-manager/Inventory-Server/handler"
	"github.com/evaan/unnamed-inventory-manager/Inventory-Server/util"
	"github.com/evaan/unnamed-inventory-manager/Shared/sharedAuth"
	"github.com/evaan/unnamed-inventory-manager/Shared/sharedDatabase"
	"github.com/gin-gonic/gin"
)

func main() {
	db, err := sharedDatabase.Connect()
	if err != nil {
		log.Fatalf("Error connecting to database: %s", err)
	}

	if err := db.AutoMigrate(&util.Item{}, &util.Changelog{}); err != nil {
		log.Fatalf("Error migrating database: %s", err)
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	frontend, err := url.Parse(frontendURL)
	if err != nil || frontend.Host == "" || (frontend.Scheme != "http" && frontend.Scheme != "https") {
		log.Fatal("FRONTEND_URL must be an absolute HTTP or HTTPS URL")
	}

	router := gin.Default()
	router.Use(sharedAuth.CORSMiddleware(frontend.Scheme + "://" + frontend.Host))

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

	router.GET("/items", func(c *gin.Context) { handler.GetItems(c, db) })
	router.GET("/items/:id", func(c *gin.Context) { handler.GetItemByID(c, db) })

	routes := router.Group("/auth")
	routes.GET("/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "API is working"})
	})

	if err := router.Run(":8081"); err != nil {
		log.Fatal(err)
	}
}
