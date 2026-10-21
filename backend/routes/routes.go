package routes

import (
	"errors"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	_ "gitlab.com/evaandev/unnamed-inventory-manager/docs"
	"gitlab.com/evaandev/unnamed-inventory-manager/inventory"
	"gitlab.com/evaandev/unnamed-inventory-manager/middleware"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

func Register(router *gin.Engine, db *gorm.DB, oauthCfg *oauth2.Config, frontendURL string) error {
	frontend, err := url.Parse(frontendURL)
	if err != nil || frontend.Host == "" || (frontend.Scheme != "http" && frontend.Scheme != "https") {
		return errors.New("FRONTEND_URL must be an absolute HTTP or HTTPS URL")
	}

	router.Use(func(c *gin.Context) {
		c.Set("secureCookies", strings.HasPrefix(oauthCfg.RedirectURL, "https://"))
		c.Next()
	})
	frontendOrigin := frontend.Scheme + "://" + frontend.Host
	router.Use(middleware.CORS(frontendOrigin))
	if gin.Mode() == gin.DebugMode {
		router.Use(middleware.CSRF(frontendOrigin, "http://localhost:8081"))
	} else {
		router.Use(middleware.CSRF(frontendOrigin))
	}
	if gin.Mode() == gin.DebugMode {
		router.GET("/", func(c *gin.Context) {
			prefix := c.GetHeader("X-Forwarded-Prefix")
			c.Redirect(http.StatusFound, path.Join("/", prefix, "swagger/index.html"))
		})
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	public := router.Group("/")
	public.Use(middleware.AuthOptional(db))
	{
		public.GET("/login", func(c *gin.Context) {
			auth.Login(c, oauthCfg)
		})

		public.GET("/callback", func(c *gin.Context) {
			auth.Callback(c, oauthCfg, db, frontendURL)
		})

		public.GET("/whoami", func(c *gin.Context) {
			auth.WhoAmI(c, db)
		})

		public.GET("/items", func(c *gin.Context) {
			inventory.GetItems(c, db)
		})

		public.GET("items/:id", func(c *gin.Context) {
			inventory.GetItemByID(c, db)
		})

		public.POST("/items", func(c *gin.Context) {
			inventory.AddItem(c, db)
		})

		public.PUT("/items/:id", func(c *gin.Context) {
			inventory.UpdateItem(c, db)
		})

		public.DELETE("/items/:id", func(c *gin.Context) {
			inventory.DeleteItem(c, db)
		})

		public.GET("/logs", func(c *gin.Context) {
			inventory.GetLogs(c, db)
		})

	}

	session := router.Group("/")
	session.Use(middleware.SessionRequired(db))
	{
		session.POST("/logout", func(c *gin.Context) {
			auth.Logout(c, db)
		})
	}

	private := router.Group("/")
	private.Use(middleware.AuthRequired(db))
	{
		private.GET("/permissions", func(c *gin.Context) {
			auth.GetPermissions(c, db)
		})
	}

	admin := router.Group("/")
	admin.Use(middleware.AuthRequired(db), middleware.AdminRequired(db))
	{
		admin.GET("/permissions/:id", func(c *gin.Context) {
			auth.GetPermissionsFromId(c, db)
		})

		admin.PUT("/permissions/:id", func(c *gin.Context) {
			auth.PutPermissions(c, db)
		})

		admin.PATCH("/user/:id", func(c *gin.Context) {
			auth.PatchUser(c, db)
		})
	}

	return nil
}
