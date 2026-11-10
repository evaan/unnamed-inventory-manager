package tests

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/database"
	"gitlab.com/evaandev/unnamed-inventory-manager/settings"
	"gorm.io/gorm"
)

func TestGetDefaultSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{
		"signup_policy":             "whitelist",
		"whitelisted_email_domains": `["mun.ca"]`,
	})
}

func TestGetSettingsIncludesNewSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	expected := getTestSettings(t, router, token)

	if err := settings.Set(db, "test_setting", "value"); err != nil {
		t.Fatal(err)
	}
	expected["test_setting"] = "value"

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestGetSettingsEmpty(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := db.Where("name IS NOT NULL").Delete(&settings.Setting{}).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, gin.H{})
}

func TestPatchSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "first", "old"); err != nil {
		t.Fatal(err)
	}
	if err := settings.Set(db, "second", "old"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)
	expected["first"] = "new"
	expected["second"] = `["example.com"]`

	response := makeRequest(router, http.MethodPatch, "/settings", `{"first":"new","second":"[\"example.com\"]"}`, token)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestPatchSettingsPreservesOmittedSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "first", "old"); err != nil {
		t.Fatal(err)
	}
	if err := settings.Set(db, "second", "unchanged"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)
	expected["first"] = "new"

	response := makeRequest(router, http.MethodPatch, "/settings", `{"first":"new"}`, token)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestPatchSettingsEmptyValue(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "test_setting", "value"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)
	expected["test_setting"] = ""

	response := makeRequest(router, http.MethodPatch, "/settings", `{"test_setting":""}`, token)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestPatchSettingsUnchangedValue(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "test_setting", "value"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)

	response := makeRequest(router, http.MethodPatch, "/settings", `{"test_setting":"value"}`, token)
	requireStatus(t, response, http.StatusNoContent)

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestPatchSettingsUnknownSetting(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "test_setting", "old"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)

	response := makeRequest(router, http.MethodPatch, "/settings", `{"test_setting":"new","unknown":"value"}`, token)
	requireStatus(t, response, http.StatusNotFound)

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
	if _, err := settings.Get(db, "unknown"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Errorf("Expected record not found, got %v", err)
	}
}

func TestPatchSettingsInvalidBody(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "test_setting", "old"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)

	for _, body := range []string{
		"", "null", "[]", "{}", "{",
		`{"test_setting":null}`,
		`{"test_setting":true}`,
		`{"test_setting":1}`,
		`{"test_setting":[]}`,
		`{"test_setting":{}}`,
		`{"test_setting":"new"} {}`,
		`{"test_setting":"new"} invalid`,
	} {
		response := makeRequest(router, http.MethodPatch, "/settings", body, token)
		requireStatus(t, response, http.StatusBadRequest)
	}

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestGetSettingsUnauthenticated(t *testing.T) {
	router, _ := newAuthRouter(t)

	response := makeRequest(router, http.MethodGet, "/settings", "", "")
	requireStatus(t, response, http.StatusUnauthorized)
}

func TestPatchSettingsUnauthenticated(t *testing.T) {
	router, _ := newAuthRouter(t)

	response := makeRequest(router, http.MethodPatch, "/settings", `{"signup_policy":"open"}`, "")
	requireStatus(t, response, http.StatusUnauthorized)
}

func TestRegularUserCannotGetSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestRegularUserCannotPatchSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "test_setting", "old"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, adminToken)

	response := makeRequest(router, http.MethodPatch, "/settings", `{"test_setting":"new"}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodGet, "/settings", "", adminToken)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestDisabledAdminCannotGetSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := db.Model(&admin).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestDisabledAdminCannotPatchSettings(t *testing.T) {
	router, db := newAuthRouter(t)
	admin, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := db.Model(&admin).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodPatch, "/settings", `{"signup_policy":"open"}`, token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestPatchSettingsRequiresOrigin(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	request := httptest.NewRequest(http.MethodPatch, "/settings", strings.NewReader(`{"signup_policy":"open"}`))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(&http.Cookie{Name: "session", Value: token})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	requireStatus(t, response, http.StatusForbidden)
}

func TestPatchSettingsRollsBackOnError(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := settings.Set(db, "first", "old"); err != nil {
		t.Fatal(err)
	}
	if err := settings.Set(db, "second", "old"); err != nil {
		t.Fatal(err)
	}
	expected := getTestSettings(t, router, token)

	if err := db.Exec(`CREATE TRIGGER reject_second_update BEFORE UPDATE ON settings
		WHEN NEW.name = 'second'
		BEGIN SELECT RAISE(ABORT, 'test error'); END`).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodPatch, "/settings", `{"first":"new","second":"new"}`, token)
	requireStatus(t, response, http.StatusInternalServerError)

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func TestGetSettingsDatabaseError(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)

	if err := db.Migrator().DropTable(&settings.Setting{}); err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusInternalServerError)
}

func TestSettingsMigrationPreservesUpdates(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)
	expected := getTestSettings(t, router, token)
	expected["signup_policy"] = "closed"
	expected["whitelisted_email_domains"] = "[]"

	response := makeRequest(router, http.MethodPatch, "/settings", `{"signup_policy":"closed","whitelisted_email_domains":"[]"}`, token)
	requireStatus(t, response, http.StatusNoContent)

	if err := database.Migrate(db); err != nil {
		t.Fatal(err)
	}

	response = makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)
	assertJSON(t, response, expected)
}

func getTestSettings(t *testing.T, router http.Handler, token string) map[string]string {
	t.Helper()

	response := makeRequest(router, http.MethodGet, "/settings", "", token)
	requireStatus(t, response, http.StatusOK)

	var values map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &values); err != nil {
		t.Fatal(err)
	}

	return values
}
