package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

func Login(c *gin.Context, oauthCfg *oauth2.Config) {
	state := GenerateToken()
	SetCookie(c, "oauth_state", state, 600)
	authURL := oauthCfg.AuthCodeURL(state)
	c.Redirect(http.StatusFound, authURL)
}
