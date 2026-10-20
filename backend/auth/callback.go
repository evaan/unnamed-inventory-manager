package auth

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"
)

// @Summary		Finish logging in with Google
// @Description	Checks the oauth_state cookie, starts a session and sends you back to the frontend
// @Tags			Auth
// @Param			state	query	string	true	"OAuth state from Google"
// @Param			code	query	string	true	"Authorization code from Google"
// @Success		303		"Redirect to the frontend"
// @Header			303		{string}	Location	"Frontend URL"
// @Header			303		{string}	Set-Cookie	"Session cookie, valid for 8 hours"
// @Failure		400		"Missing code or invalid OAuth state"
// @Failure		401		"Invalid Google login or unverified email"
// @Failure		409		"User details already in use"
// @Failure		500		"Error logging in"
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

	sessionToken := GenerateToken()
	var user User
	status := http.StatusInternalServerError
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := lockPermissions(tx); err != nil {
			return err
		}
		err := tx.Where("google_id = ?", payload.Subject).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			user = User{ID: uuid.New(), Name: name, Email: email, GoogleID: payload.Subject, Disabled: false}
			if err := tx.Create(&user).Error; err != nil {
				if errors.Is(err, gorm.ErrDuplicatedKey) {
					status = http.StatusConflict
				}
				return err
			}
		} else if err != nil {
			return err
		}
		if !user.Disabled && email == os.Getenv("ADMIN_EMAIL") {
			var count int64
			if err := tx.Model(&UserPermission{}).Where("permission = ?", PermissionAdministrator).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				if err := tx.Create(&UserPermission{UserID: user.ID, Permission: PermissionAdministrator}).Error; err != nil {
					return err
				}
			}
		}

		return tx.Create(&UserSession{
			UserID: user.ID, SessionToken: HashToken(sessionToken), Expires: time.Now().Add(8 * time.Hour),
		}).Error
	})
	if err != nil {
		c.AbortWithStatus(status)
		return
	}

	SetCookie(c, "session", sessionToken, 8*60*60)
	c.Redirect(http.StatusSeeOther, frontendURL)
}
