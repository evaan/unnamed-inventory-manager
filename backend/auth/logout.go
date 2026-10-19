package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Log out
// @Description	Deletes your session and clears the session cookie. Must be logged in
// @Tags			Auth
// @Param			Origin	header	string	false	"Frontend origin, required if Referer is not set"
// @Success		200		"Logged out"
// @Header			200		{string}	Set-Cookie	"Clears the session cookie"
// @Failure		400		"Missing session cookie"
// @Failure		401		"Not logged in"
// @Failure		403		"Invalid or missing frontend Origin or Referer"
// @Failure		500		"Error logging out"
// @Router			/logout [post]
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
