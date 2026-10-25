package tests

import (
	"net/http"
	"testing"
	"uuid"

	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gitlab.com/evaandev/unnamed-inventory-manager/inventory"
)

func TestAddItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	body := `{
		"itemName": "TestItem1",
		"quantity": 1,
		"manufacturer": "TestCompany",
		"manufacturerPart": "A1",
		"description": "This is a test item"
	}`

	response := makeRequest(router, http.MethodPost, "/items", body, adminToken)

	requireStatus(t, response, http.StatusCreated)
}

func TestAddInvalidItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	// Theres no value for the "Quantity" field
	body := `{
		"itemName": "TestItem1", 
		
		"manufacturer": "TestCompany",
		"manufacturerPart": "A1",
		"description": "This is a test item"
	}`

	response := makeRequest(router, http.MethodPost, "/items", body, adminToken)

	requireStatus(t, response, http.StatusBadRequest)
}

func TestGetItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")

	testItemToGet := inventory.Item{
		ID:               uuid.New(),
		ItemName:         "TestItem1",
		Quantity:         1,
		Manufacturer:     "TestCompany",
		ManufacturerPart: "A1",
	}

	if err := db.Create(&testItemToGet).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/items/"+testItemToGet.ID.String(), "", token)

	requireStatus(t, response, http.StatusOK)
}

func TestGetNonExistentItem(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")

	randomID := uuid.New()

	response := makeRequest(router, http.MethodGet, "/items/"+randomID.String(), "", token)

	requireStatus(t, response, http.StatusNotFound)
}

func TestEditItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View", "Edit")

	testItemToEdit := inventory.Item{
		ID:               uuid.New(),
		ItemName:         "TestItem1",
		Quantity:         1,
		Manufacturer:     "TestCompany",
		ManufacturerPart: "A1",
	}

	if err := db.Create(&testItemToEdit).Error; err != nil {
		t.Fatal(err)
	}

	body := `{
		"quantity": 2
	}`

	response := makeRequest(router, http.MethodPut, "/items/"+testItemToEdit.ID.String(), body, token)

	requireStatus(t, response, http.StatusOK)
}

func TestRemoveItem(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	testItemToRemove := inventory.Item{
		ID:               uuid.New(),
		ItemName:         "TestItem1",
		Quantity:         1,
		Manufacturer:     "TestCompany",
		ManufacturerPart: "A1",
	}

	if err := db.Create(&testItemToRemove).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodDelete, "/items/"+testItemToRemove.ID.String(), "", adminToken)

	requireStatus(t, response, http.StatusNoContent)
}
