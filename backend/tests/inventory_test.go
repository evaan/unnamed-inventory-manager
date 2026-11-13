package tests

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"uuid"

	"gorm.io/gorm"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
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

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusCreated)

	var result struct {
		Item inventory.Item `json:"item"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item created: %v", err)
	}

	var addedItem inventory.Item

	// Ensure Item was successfully added to the database
	if err := db.First(&addedItem, "id = ?", result.Item.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure all the properties are still correct
	if addedItem.ItemName != "TestItem1" {
		t.Errorf("Expected Name: TestItem1 | Actual Value: %q", addedItem.ItemName)
	}
	if addedItem.Quantity != 1 {
		t.Errorf("Expected Quantity: 1 | Actual Value: %d", addedItem.Quantity)
	}
	if addedItem.Manufacturer != "TestCompany" {
		t.Errorf("Expected Manufacturer: TestCompany | Actual Value: %q", addedItem.Manufacturer)
	}
	if addedItem.ManufacturerPart != "A1" {
		t.Errorf("Expected ManufacturerPart: A1 | Actual Value: %q", addedItem.ManufacturerPart)
	}
	if addedItem.Description != "This is a test item" {
		t.Errorf("Expected Description: This is a test item | Actual Value: %q", addedItem.Description)
	}

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

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusBadRequest)

	var result struct {
		Item inventory.Item `json:"item"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item: %v", err)
	}

	var invalidItem inventory.Item

	// Ensure Item was not created within the database
	err := db.First(&invalidItem, "id = ?", result.Item.ID).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Successful case
	} else if err != nil {
		t.Fatalf("Database Query failed: %v", err)
	} else {
		t.Fatalf("Invalid item found within database: %v", err)
	}
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

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusOK)

	var result struct {
		Item inventory.Item `json:"item"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item created: %v", err)
	}

	var retrievedItem inventory.Item

	// Ensure Item was successfullly added to the database
	if err := db.First(&retrievedItem, "id = ?", result.Item.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure the properties of the retrieved item match all the properties of the one added to the database
	if retrievedItem.ItemName != "TestItem1" {
		t.Errorf("Expected Name: TestItem1 | Actual Value: %q", retrievedItem.ItemName)
	}
	if retrievedItem.Quantity != 1 {
		t.Errorf("Expected Quantity: 1 | Actual Value: %d", retrievedItem.Quantity)
	}
	if retrievedItem.Manufacturer != "TestCompany" {
		t.Errorf("Expected Manufacturer: TestCompany | Actual Value: %q", retrievedItem.Manufacturer)
	}
	if retrievedItem.ManufacturerPart != "A1" {
		t.Errorf("Expected ManufacturerPart: A1 | Actual Value: %q", retrievedItem.ManufacturerPart)
	}
}

func TestGetNonExistentItem(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")

	randomID := uuid.New()

	response := makeRequest(router, http.MethodGet, "/items/"+randomID.String(), "", token)

	// Ensure HTTP response is correct
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

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusOK)

	var result struct {
		Item inventory.Item `json:"item"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item: %v", err)
	}

	var editedItem inventory.Item

	// Ensure Item was successfullly added to the database
	if err := db.First(&editedItem, "id = ?", result.Item.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure the properties of the retrieved item match and that the quantity is now updated to 2
	if editedItem.ItemName != "TestItem1" {
		t.Errorf("Expected Name: TestItem1 | Actual Value: %q", editedItem.ItemName)
	}
	if editedItem.Quantity != 2 {
		t.Errorf("Expected Quantity: 2 | Actual Value: %d", editedItem.Quantity)
	}
	if editedItem.Manufacturer != "TestCompany" {
		t.Errorf("Expected Manufacturer: TestCompany | Actual Value: %q", editedItem.Manufacturer)
	}
	if editedItem.ManufacturerPart != "A1" {
		t.Errorf("Expected ManufacturerPart: A1 | Actual Value: %q", editedItem.ManufacturerPart)
	}
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

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusNoContent)

	var removedItem inventory.Item

	// Ensure Item was not created within the database
	err := db.First(&removedItem, "id = ?", testItemToRemove.ID).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Successful case
	} else if err != nil {
		t.Fatalf("Database query failed: %v", err)
	} else {
		t.Fatalf("Removed item still found within database: %v", err)
	}
}
