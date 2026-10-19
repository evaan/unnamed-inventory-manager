package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Logout(c *gin.Context, db *gorm.DB) {
	token, err := c.Cookie("session")
	if token == "" || err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := db.WithContext(c.Request.Context()).Where("session_token = ?", HashToken(token)).Delete(&UserSession{}).Error; err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	SetCookie(c, "session", "", -1)
	c.Status(http.StatusOK)
}
