package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func AuthOptional(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("session_token")
		if err != nil || token == "" {
			c.Next()
			return
		}

		var session UserSession
		err = db.Where("session_token = ?", token).First(&session).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
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
			c.SetCookie("session_token", "", -1, "/", "", false, true)
			c.Next()
			return
		}

		var user User
		err = db.First(&user, "id = ?", session.UserID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.Next()
			return
		}
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		c.Set("user", &user)
		c.Next()
	}
}

func AuthRequired(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("session_token")
		if err != nil || token == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		var session UserSession
		err = db.Where("session_token = ?", token).First(&session).Error
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusUnauthorized
			}
			c.AbortWithStatus(status)
			return
		}
		if !session.Expires.After(time.Now()) {
			db.Delete(&session)
			c.SetCookie("session_token", "", -1, "/", "", false, true)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		var user User
		err = db.First(&user, "id = ?", session.UserID).Error
		if err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = http.StatusUnauthorized
			}
			c.AbortWithStatus(status)
			return
		}
		c.Set("user", &user)
		c.Next()
	}
}
