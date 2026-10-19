package main

import (
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/database"
	"gitlab.com/evaandev/unnamed-inventory-manager/inventory"
	"gitlab.com/evaandev/unnamed-inventory-manager/middleware"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

func main() {
	db, err := database.Connect()
	if err != nil {
		log.Fatalf("Error connecting to database: %s", err)
	}

	if err := db.AutoMigrate(&auth.User{}, &auth.UserPermission{}, &auth.UserSession{}, &inventory.Item{}, &inventory.Changelog{}); err != nil {
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
	router.Use(middleware.CORS(frontend.Scheme + "://" + frontend.Host))

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

	public := router.Group("/")
	public.Use(auth.AuthOptional(db))
	{
		public.GET("/login", func(c *gin.Context) {
			auth.Login(c, oauthCfg, frontendURL)
		})

		public.GET("/callback", func(c *gin.Context) {
			auth.Callback(c, oauthCfg, db, frontendURL)
		})

		public.GET("/whoami", func(c *gin.Context) {
			auth.WhoAmI(c, db)
		})
	}

	private := router.Group("/")
	private.Use(auth.AuthRequired(db))
	{
		private.POST("/logout", func(c *gin.Context) {
			auth.Logout(c, db)
		})

		private.GET("/items", func(c *gin.Context) {
			inventory.GetItems(c, db)
		})

		private.GET("items/:id", func(c *gin.Context) {
			inventory.GetItem(c, db)
		})
	}

	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
