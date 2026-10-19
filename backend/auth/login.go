package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

// @Summary		Log in with Google
// @Description	Saves the login state in a cookie and sends you to Google
// @Tags			Auth
// @Success		302	"Redirect to Google"
// @Header			302	{string}	Location	"Google login URL"
// @Header			302	{string}	Set-Cookie	"OAuth state cookie, valid for 10 minutes"
// @Failure		500	"Error checking session"
// @Router			/login [get]
func Login(c *gin.Context, oauthCfg *oauth2.Config) {
	state := GenerateToken()
	SetCookie(c, "oauth_state", state, 600)
	authURL := oauthCfg.AuthCodeURL(state)
	c.Redirect(http.StatusFound, authURL)
}
