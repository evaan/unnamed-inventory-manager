package middleware

import (
	"errors"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gorm.io/gorm"
)

func AuthOptional(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		db := db.WithContext(c.Request.Context())
		token, err := c.Cookie("session")
		if err != nil || token == "" {
			c.Next()
			return
		}

		var session auth.UserSession
		err = db.Where("session_token = ?", auth.HashToken(token)).First(&session).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			auth.SetCookie(c, "session", "", -1)
			c.Next()
			return
		}
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if !session.Expires.After(time.Now()) {
			if err := db.Delete(&session).Error; err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			auth.SetCookie(c, "session", "", -1)
			c.Next()
			return
		}

		var user auth.User
		err = db.First(&user, "id = ?", session.UserID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			auth.SetCookie(c, "session", "", -1)
			c.Next()
			return
		}
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if user.Disabled {
			if err := db.Where("user_id = ?", user.ID).Delete(&auth.UserSession{}).Error; err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			auth.SetCookie(c, "session", "", -1)
			c.Next()
			return
		}
		c.Set("user", &user)
		c.Next()
	}
}

func AuthRequired(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		db := db.WithContext(c.Request.Context())
		token, err := c.Cookie("session")
		if err != nil || token == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		var session auth.UserSession
		err = db.Where("session_token = ?", auth.HashToken(token)).First(&session).Error
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusUnauthorized
				auth.SetCookie(c, "session", "", -1)
			}
			c.AbortWithStatus(status)
			return
		}
		if !session.Expires.After(time.Now()) {
			if err := db.Delete(&session).Error; err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			auth.SetCookie(c, "session", "", -1)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		var user auth.User
		err = db.First(&user, "id = ?", session.UserID).Error
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusUnauthorized
				auth.SetCookie(c, "session", "", -1)
			}
			c.AbortWithStatus(status)
			return
		}
		if user.Disabled {
			if err := db.Where("user_id = ?", user.ID).Delete(&auth.UserSession{}).Error; err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
			auth.SetCookie(c, "session", "", -1)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		c.Set("user", &user)
		c.Next()
	}
}

func AdminRequired(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := auth.GetUser(c)
		if err != nil {
			c.AbortWithError(http.StatusUnauthorized, err)
			return
		}

		isAdmin, err := auth.IsAdmin(db.WithContext(c.Request.Context()), user)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		if !isAdmin {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}

		c.Next()
	}
}

func CSRF(allowedOrigins ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}

		origin := c.GetHeader("Origin")
		if origin == "" {
			referer, err := url.Parse(c.GetHeader("Referer"))
			if err == nil && referer.Host != "" && referer.User == nil {
				origin = referer.Scheme + "://" + referer.Host
			}
		}
		for _, allowed := range allowedOrigins {
			if origin != "" && origin == allowed {
				c.Next()
				return
			}
		}
		c.AbortWithStatus(http.StatusForbidden)
	}
}
