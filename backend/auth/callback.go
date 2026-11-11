package auth

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"
)

// @Summary		Finish logging in with Google
// @Description	Checks the oauth_state cookie, verifies the Google identity and email, starts a session and sends you back to the frontend.
// @Description	New users follow signup_policy: open enables them, whitelist enables exact whitelisted email domain matches, and closed creates them disabled for approval.
// @Description	A matching non-empty ADMIN_EMAIL bypasses signup restrictions for new users. Existing users keep their disabled status
// @Tags			Auth
// @Param			state	query	string	true	"OAuth state from Google"
// @Param			code	query	string	true	"Authorization code from Google"
// @Success		303		"Redirect to the frontend"
// @Header			303		{string}	Location	"Frontend URL"
// @Header			303		{string}	Set-Cookie	"Session cookie, valid for 8 hours"
// @Failure		400		"Missing code or invalid OAuth state"
// @Failure		401		"Invalid Google login or unverified email"
// @Failure		409		"User details already in use"
// @Failure		500		"Error logging in or invalid signup settings"
// @Router			/callback [get]
func Callback(c *gin.Context, oauthCfg *oauth2.Config, db *gorm.DB, frontendURL string) {
	state := c.Query("state")
	expectedState, err := c.Cookie("oauth_state")
	if err != nil || state == "" || subtle.ConstantTimeCompare([]byte(state), []byte(expectedState)) != 1 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	SetCookie(c, "oauth_state", "", -1)
	ctx := c.Request.Context()
	db = db.WithContext(ctx)
	code := c.Query("code")
	if code == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	token, err := oauthCfg.Exchange(ctx, code)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	rawIDToken, _ := token.Extra("id_token").(string)
	if rawIDToken == "" {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	payload, err := idtoken.Validate(ctx, rawIDToken, oauthCfg.ClientID)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	verified, _ := payload.Claims["email_verified"].(bool)
	if !verified || strings.TrimSpace(email) == "" || payload.Subject == "" ||
		(payload.Issuer != "accounts.google.com" && payload.Issuer != "https://accounts.google.com") {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	sessionToken, err := CreateLoginSession(db, payload.Subject, name, email)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			status = http.StatusConflict
		}
		c.AbortWithStatus(status)
		return
	}

	SetCookie(c, "session", sessionToken, 8*60*60)
	c.Redirect(http.StatusSeeOther, frontendURL)
}
