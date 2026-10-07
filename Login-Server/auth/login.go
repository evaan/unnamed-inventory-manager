package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

func Login(c *gin.Context, oauthCfg *oauth2.Config, frontendURL string) {
	// OAuth state protects the login callback against CSRF.
	state := GenerateToken()
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("oauth_state", state, 600, "/", "", strings.HasPrefix(oauthCfg.RedirectURL, "https://"), true)
	authURL := oauthCfg.AuthCodeURL(state)
	c.Redirect(http.StatusFound, authURL)
}
