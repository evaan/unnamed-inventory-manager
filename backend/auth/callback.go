package auth

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/evaan/unnamed-inventory-manager/Login-Server/util"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/api/idtoken"
	"gorm.io/gorm"
)

func Callback(c *gin.Context, oauthCfg *oauth2.Config, db *gorm.DB, frontendURL string) {
	state := c.Query("state")
	expectedState, err := c.Cookie("oauth_state")
	if err != nil || state == "" || subtle.ConstantTimeCompare([]byte(state), []byte(expectedState)) != 1 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	secure := strings.HasPrefix(oauthCfg.RedirectURL, "https://")
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("oauth_state", "", -1, "/", "", secure, true)
	code := c.Query("code")
	if code == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	ctx := c.Request.Context()
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
	var user util.User
	err = db.Where("email = ?", email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		user = util.User{ID: uuid.New(), Name: name, Email: email}
		if err := db.Create(&user).Error; err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		var count int64
		if err := db.Model(&util.User{}).Count(&count).Error; err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}
		if count == 1 {
			if err := db.Create(&util.UserPermission{UserID: user.ID, Permission: "Administrator"}).Error; err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
		}
	} else if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	if err := db.Create(&util.UserSession{
		UserID: user.ID, SessionToken: sessionToken, Expires: time.Now().Add(8 * time.Hour),
	}).Error; err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.SetCookie("session_token", sessionToken, 8*60*60, "/", "", secure, true)
	c.Redirect(http.StatusSeeOther, frontendURL)
}
