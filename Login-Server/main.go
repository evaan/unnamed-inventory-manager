package main

import (
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/evaan/unnamed-inventory-manager/auth"
	"github.com/evaan/unnamed-inventory-manager/util"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	db, err := gorm.Open(postgres.Open(os.Getenv("POSTGRES_URL")), &gorm.Config{})
	if err != nil {
		log.Fatalf("Error connecting to database: %s", err)
	}

	if err := db.AutoMigrate(&util.User{}, &util.UserSession{}, &util.UserPermission{}); err != nil {
		log.Fatalf("Error migrating database: %s", err)
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	frontend, err := url.Parse(frontendURL)
	if err != nil || frontend.Host == "" || (frontend.Scheme != "http" && frontend.Scheme != "https") {
		log.Fatal("FRONTEND_URL must be an absolute HTTP or HTTPS URL")
	}
	oauthCfg := &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
		Endpoint:     google.Endpoint,
		Scopes:       []string{"openid", "email", "profile"},
	}
	if oauthCfg.ClientID == "" || oauthCfg.ClientSecret == "" || oauthCfg.RedirectURL == "" {
		log.Fatal("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URL must be set")
	}

	router := gin.Default()
	router.Use(auth.CORSMiddleware(frontend.Scheme + "://" + frontend.Host))

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

	routes := router.Group("/auth")
	routes.GET("/login", func(c *gin.Context) {
		auth.Login(c, oauthCfg, frontendURL)
	})
	routes.GET("/callback", func(c *gin.Context) {
		auth.Callback(c, oauthCfg, db, frontendURL)
	})
	routes.GET("/whoami", auth.AuthOptional(db), func(c *gin.Context) {
		auth.WhoAmI(c, db)
	})
	routes.POST("/logout", auth.AuthRequired(db), func(c *gin.Context) {
		auth.Logout(c, db)
	})

	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
