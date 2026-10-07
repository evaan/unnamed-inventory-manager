package auth

import (
	"net/http"

	"github.com/evaan/unnamed-inventory-manager/util"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Logout(c *gin.Context, db *gorm.DB) {
	token, err := c.Cookie("session_token")
	if token == "" || err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	if err := db.Where("session_token = ?", token).Delete(&util.UserSession{}).Error; err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.SetCookie("session_token", "", -1, "/", "", false, true)
	c.Status(http.StatusOK)
}
