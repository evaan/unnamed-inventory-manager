package tests

import (
	"net/http"
	"sort"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/routes"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

func TestWhoAmIUnauthenticated(t *testing.T) {
	router, _ := newAuthRouter(t)

	response := makeRequest(router, http.MethodGet, "/whoami", "", "")
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{"loggedIn": false})
}

func TestWhoAmIRegularUser(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newTestSession(t, db)

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

func TestWhoAmIDisabledUser(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newTestSession(t, db)

	if err := db.Model(&user).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn": true,
		"disabled": true,
	})
}

func TestGetPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View", "Edit")

	response := makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{"Edit", "View"})
}

func TestGetPermissionsUnauthenticated(t *testing.T) {
	router, _ := newAuthRouter(t)

	response := makeRequest(router, http.MethodGet, "/permissions", "", "")
	requireStatus(t, response, http.StatusUnauthorized)
}

func TestGetUserPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db, "View")

	response := makeRequest(router, http.MethodGet, "/permissions/"+user.ID.String(), "", adminToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{"View"})
}

func TestGetUnknownUserPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	response := makeRequest(router, http.MethodGet, "/permissions/"+uuid.NewString(), "", token)
	requireStatus(t, response, http.StatusNotFound)
}

func TestGetUserPermissionsInvalidID(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	response := makeRequest(router, http.MethodGet, "/permissions/invalid", "", token)
	requireStatus(t, response, http.StatusBadRequest)
}

func TestSetPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, token := newTestSession(t, db, "Old")

	response := makeRequest(router, http.MethodPut, "/permissions/"+user.ID.String(), `{"permissions":["View","Edit"]}`, adminToken)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{"Edit", "View"})

	response = makeRequest(router, http.MethodGet, "/permissions", "", adminToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{auth.PermissionAdministrator})
}

func TestClearPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, token := newTestSession(t, db, "View")

	response := makeRequest(router, http.MethodPut, "/permissions/"+user.ID.String(), `{"permissions":[]}`, adminToken)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{})
}

func TestRegularUserCannotSetPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newTestSession(t, db, "View")

	response := makeRequest(router, http.MethodPut, "/permissions/"+user.ID.String(), `{"permissions":["Administrator"]}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{"View"})
}

func TestRemovingAdminBlocksAdminActions(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)
	user, userToken := newTestSession(t, db)
	path := "/permissions/" + admin.ID.String()

	response := makeRequest(router, http.MethodPut, path, `{"permissions":["View"]}`, token)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{"View"})

	response = makeRequest(router, http.MethodGet, "/permissions/"+user.ID.String(), "", token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodPut, path, `{"permissions":["Administrator"]}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodPatch, "/user/"+user.ID.String(), `{"disabled":true}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodGet, "/whoami", "", userToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn":    true,
		"disabled":    false,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": []string{},
	})
}

func TestGetUsers(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db, "View", "Edit")
	userWithoutPermissions, _ := newTestSession(t, db)

	response := makeRequest(router, http.MethodGet, "/users", "", token)
	requireStatus(t, response, http.StatusOK)
	expected := []gin.H{
		{
			"id":          admin.ID.String(),
			"name":        admin.Name,
			"email":       admin.Email,
			"disabled":    false,
			"permissions": []string{auth.PermissionAdministrator},
		},
		{
			"id":          user.ID.String(),
			"name":        user.Name,
			"email":       user.Email,
			"disabled":    false,
			"permissions": []string{"Edit", "View"},
		},
		{
			"id":          userWithoutPermissions.ID.String(),
			"name":        userWithoutPermissions.Name,
			"email":       userWithoutPermissions.Email,
			"disabled":    false,
			"permissions": []string{},
		},
	}
	sort.Slice(expected, func(i, j int) bool {
		return expected[i]["email"].(string) < expected[j]["email"].(string)
	})
	assertJSON(t, response, expected)
}

func TestGetUsersIncludesDisabledUsers(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db, "View")

	if err := db.Model(&user).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/users", "", token)
	requireStatus(t, response, http.StatusOK)
	expected := []gin.H{
		{
			"id":          admin.ID.String(),
			"name":        admin.Name,
			"email":       admin.Email,
			"disabled":    false,
			"permissions": []string{auth.PermissionAdministrator},
		},
		{
			"id":          user.ID.String(),
			"name":        user.Name,
			"email":       user.Email,
			"disabled":    true,
			"permissions": []string{"View"},
		},
	}
	sort.Slice(expected, func(i, j int) bool {
		return expected[i]["email"].(string) < expected[j]["email"].(string)
	})
	assertJSON(t, response, expected)
}

func TestGetUsersEmpty(t *testing.T) {
	db := newTestDB(t)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/users", func(c *gin.Context) {
		auth.GetUsers(c, db)
	})

	response := makeRequest(router, http.MethodGet, "/users", "", "")
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []gin.H{})
}

func TestGetUsersUnauthenticated(t *testing.T) {
	router, _ := newAuthRouter(t)

	response := makeRequest(router, http.MethodGet, "/users", "", "")
	requireStatus(t, response, http.StatusUnauthorized)
}

func TestRegularUserCannotGetUsers(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")

	response := makeRequest(router, http.MethodGet, "/users", "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestDisabledAdminCannotGetUsers(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := db.Model(&admin).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/users", "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestGetUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db, "View", "Edit")

	response := makeRequest(router, http.MethodGet, "/user/"+user.ID.String(), "", adminToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"id":          user.ID.String(),
		"name":        user.Name,
		"email":       user.Email,
		"disabled":    false,
		"permissions": []string{"Edit", "View"},
	})
}

func TestGetUserWithoutPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db)

	response := makeRequest(router, http.MethodGet, "/user/"+user.ID.String(), "", adminToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"id":          user.ID.String(),
		"name":        user.Name,
		"email":       user.Email,
		"disabled":    false,
		"permissions": []string{},
	})
}

func TestGetDisabledUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db, "View")

	if err := db.Model(&user).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/user/"+user.ID.String(), "", adminToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"id":          user.ID.String(),
		"name":        user.Name,
		"email":       user.Email,
		"disabled":    true,
		"permissions": []string{"View"},
	})
}

func TestGetUnknownUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	response := makeRequest(router, http.MethodGet, "/user/"+uuid.NewString(), "", token)
	requireStatus(t, response, http.StatusNotFound)
}

func TestGetUserInvalidID(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	response := makeRequest(router, http.MethodGet, "/user/invalid", "", token)
	requireStatus(t, response, http.StatusBadRequest)
}

func TestGetUserUnauthenticated(t *testing.T) {
	router, db := newAuthRouter(t)
	user, _ := newTestSession(t, db)

	response := makeRequest(router, http.MethodGet, "/user/"+user.ID.String(), "", "")
	requireStatus(t, response, http.StatusUnauthorized)
}

func TestRegularUserCannotGetUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")
	user, _ := newTestSession(t, db)

	response := makeRequest(router, http.MethodGet, "/user/"+user.ID.String(), "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestDisabledAdminCannotGetUser(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)
	user, _ := newTestSession(t, db)

	if err := db.Model(&admin).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/user/"+user.ID.String(), "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestDisableAndEnableUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)
	user, token := newTestSession(t, db, "View")
	path := "/user/" + user.ID.String()

	response := makeRequest(router, http.MethodPatch, path, `{"disabled":true}`, adminToken)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn": true,
		"disabled": true,
	})

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodPatch, path, `{"disabled":false}`, adminToken)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"loggedIn":    true,
		"disabled":    false,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": []string{"View"},
	})

	response = makeRequest(router, http.MethodGet, "/permissions", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{"View"})
}

func TestRegularUserCannotDisableUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db)
	user, userToken := newTestSession(t, db)

	response := makeRequest(router, http.MethodPatch, "/user/"+user.ID.String(), `{"disabled":true}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodGet, "/permissions", "", userToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, []string{})
}

func TestLogout(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db)

	response := makeRequest(router, http.MethodPost, "/logout", "", token)
	requireStatus(t, response, http.StatusOK)

	response = makeRequest(router, http.MethodGet, "/whoami", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{"loggedIn": false})
}

func newAuthRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	t.Setenv("ADMIN_EMAIL", "")

	db := newTestDB(t)
	oauthCfg := &oauth2.Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURL:  "http://localhost/callback",
		Endpoint:     google.Endpoint,
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := routes.Register(router, db, oauthCfg, testFrontendURL); err != nil {
		t.Fatal(err)
	}

	return router, db
}
