package tests

import (
	"net/http"
	"testing"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/settings"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestSignupOpen(t *testing.T) {
	router, db := newAuthRouter(t)

	if err := settings.Set(db, "signup_policy", "open"); err != nil {
		t.Fatal(err)
	}
	user, token := newSignupSession(t, db, "new@example.com")

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn":    true,
		"disabled":    false,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": []string{},
	})
}

func TestSignupWhitelistedEmail(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newSignupSession(t, db, "new@MUN.CA")

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn":    true,
		"disabled":    false,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": []string{},
	})
}

func TestSignupOutsideWhitelist(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newSignupSession(t, db, "new@example.com")

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn": true,
		"disabled": true,
	})

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestSignupWhitelistExactDomain(t *testing.T) {
	_, db := newAuthRouter(t)

	for _, email := range []string{"new@notmun.ca", "new@mun.ca.example.com", "new@mail.mun.ca", "new@mun.ca."} {
		user, _ := newSignupSession(t, db, email)
		if !user.Disabled {
			t.Errorf("Expected %s to be disabled", email)
		}
	}
}

func TestSignupClosed(t *testing.T) {
	router, db := newAuthRouter(t)
	t.Setenv("ADMIN_EMAIL", "admin@example.com")

	if err := settings.Set(db, "signup_policy", "closed"); err != nil {
		t.Fatal(err)
	}
	_, token := newSignupSession(t, db, "new@mun.ca")

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn": true,
		"disabled": true,
	})
}

func TestSignupInvalidPolicy(t *testing.T) {
	_, db := newAuthRouter(t)

	if err := settings.Set(db, "signup_policy", "invalid"); err != nil {
		t.Fatal(err)
	}

	token, err := auth.CreateLoginSession(db, "test-google-id", "Test User", "new@mun.ca")
	if err == nil {
		t.Error("Expected signup to fail with an invalid policy")
	}
	if token != "" {
		t.Error("Expected no session token after failed signup")
	}
}

func TestSignupInvalidWhitelist(t *testing.T) {
	_, db := newAuthRouter(t)

	for _, value := range []string{"invalid", "null", `"mun.ca"`, `[1]`} {
		if err := settings.Set(db, "whitelisted_email_domains", value); err != nil {
			t.Fatal(err)
		}

		token, err := auth.CreateLoginSession(db, "test-google-id", "Test User", "new@mun.ca")
		if err == nil {
			t.Errorf("Expected signup to fail for whitelist %q", value)
		}
		if token != "" {
			t.Error("Expected no session token after failed signup")
		}
	}
}

func TestExistingEnabledUserCanLoginWithClosedSignup(t *testing.T) {
	router, db := newAuthRouter(t)
	user, _ := newTestSession(t, db, "View")

	if err := settings.Set(db, "signup_policy", "closed"); err != nil {
		t.Fatal(err)
	}

	token, err := auth.CreateLoginSession(db, user.GoogleID, user.Name, user.Email)
	if err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn":    true,
		"disabled":    false,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": []string{"View"},
	})
}

func TestExistingDisabledUserStaysDisabledWithOpenSignup(t *testing.T) {
	router, db := newAuthRouter(t)
	user, _ := newTestSession(t, db)

	if err := db.Model(&user).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}
	if err := settings.Set(db, "signup_policy", "open"); err != nil {
		t.Fatal(err)
	}

	token, err := auth.CreateLoginSession(db, user.GoogleID, user.Name, user.Email)
	if err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn": true,
		"disabled": true,
	})

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestSignupBootstrapAdminBypassesWhitelist(t *testing.T) {
	router, db := newAuthRouter(t)
	t.Setenv("ADMIN_EMAIL", "admin@example.com")

	_, token := newSignupSession(t, db, "admin@example.com")

	response := makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{auth.PermissionAdministrator})
}

func TestSignupBootstrapAdminBypassesClosedSignup(t *testing.T) {
	router, db := newAuthRouter(t)
	t.Setenv("ADMIN_EMAIL", "admin@example.com")

	if err := settings.Set(db, "signup_policy", "closed"); err != nil {
		t.Fatal(err)
	}

	_, token := newSignupSession(t, db, "admin@example.com")

	response := makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{auth.PermissionAdministrator})
}

func TestSignupEmptyAdminEmailDoesNotBypassPolicy(t *testing.T) {
	_, db := newAuthRouter(t)
	t.Setenv("ADMIN_EMAIL", "")

	if err := settings.Set(db, "signup_policy", "closed"); err != nil {
		t.Fatal(err)
	}

	user, _ := newSignupSession(t, db, "new@mun.ca")
	if !user.Disabled {
		t.Error("Expected signup policy to apply when ADMIN_EMAIL is empty")
	}

	permissions, err := auth.GetUserPermissions(db, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(permissions) != 0 {
		t.Errorf("Expected no permissions, got %v", permissions)
	}
}

func TestExistingDisabledBootstrapAdminStaysDisabled(t *testing.T) {
	router, db := newAuthRouter(t)
	user, _ := newTestSession(t, db)
	t.Setenv("ADMIN_EMAIL", user.Email)

	if err := db.Model(&user).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	token, err := auth.CreateLoginSession(db, user.GoogleID, user.Name, user.Email)
	if err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn": true,
		"disabled": true,
	})

	permissions, err := auth.GetUserPermissions(db, user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(permissions) != 0 {
		t.Errorf("Expected no permissions, got %v", permissions)
	}
}

func newSignupSession(t *testing.T, db *gorm.DB, email string) (auth.User, string) {
	t.Helper()

	googleID := uuid.NewString()
	token, err := auth.CreateLoginSession(db, googleID, "Test User", email)
	if err != nil {
		t.Fatal(err)
	}

	var user auth.User
	if err := db.Where("google_id = ?", googleID).First(&user).Error; err != nil {
		t.Fatal(err)
	}

	return user, token
}
