package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/database"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const testFrontendURL = "http://localhost:3000"

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{TranslateError: true})
	if err != nil {
		t.Fatal(err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}

	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Error(err)
		}
	})

	if err := database.Migrate(db); err != nil {
		t.Fatal(err)
	}

	return db
}

func newTestSession(t *testing.T, db *gorm.DB, permissions ...string) (auth.User, string) {
	t.Helper()

	id := uuid.New()
	user := auth.User{
		ID:       id,
		Name:     "Test User",
		Email:    id.String() + "@example.com",
		GoogleID: id.String(),
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	token := auth.GenerateToken()
	session := auth.UserSession{
		UserID:       user.ID,
		SessionToken: auth.HashToken(token),
		Expires:      time.Now().Add(time.Hour),
	}
	if err := db.Create(&session).Error; err != nil {
		t.Fatal(err)
	}

	for _, permission := range permissions {
		if err := db.Create(&auth.UserPermission{UserID: user.ID, Permission: permission}).Error; err != nil {
			t.Fatal(err)
		}
	}

	return user, token
}

func makeRequest(router http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", testFrontendURL)

	if token != "" {
		request.AddCookie(&http.Cookie{Name: "session", Value: token})
	}

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	return response
}

func requireStatus(t *testing.T, response *httptest.ResponseRecorder, expected int) {
	t.Helper()

	if response.Code != expected {
		t.Fatalf("Expected status %d, got %d: %s", expected, response.Code, response.Body.String())
	}
}

func assertJSON(t *testing.T, response *httptest.ResponseRecorder, expected any) {
	t.Helper()

	body, err := json.Marshal(expected)
	if err != nil {
		t.Fatal(err)
	}

	if response.Body.String() != string(body) {
		t.Errorf("Expected %s, got %s", body, response.Body.String())
	}
}
