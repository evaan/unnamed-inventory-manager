package auth

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

func Login(c *gin.Context, oauthCfg *oauth2.Config, db *gorm.DB) {
	state := GenerateToken()
	verifier := oauth2.GenerateVerifier()
	if err := db.WithContext(c.Request.Context()).Create(&OAuthState{
		StateHash: HashToken(state), CodeVerifier: verifier, Expires: time.Now().Add(10 * time.Minute),
	}).Error; err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	SetCookie(c, "oauth_state", state, 600)
	authURL := oauthCfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
	c.Redirect(http.StatusFound, authURL)
}
