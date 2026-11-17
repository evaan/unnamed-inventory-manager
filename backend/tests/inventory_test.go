package tests

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"uuid"

	"slices"

	"gorm.io/gorm"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
)

func TestAddItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionCreateItem)

	body := `{
		"itemName": "TestItem1",
		"quantity": 1,
		"manufacturer": "TestCompany",
		"manufacturerPart": "A1",
		"description": "This is a test item"
	}`

	response := makeRequest(router, http.MethodPost, "/items", body, token)

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
	_, token := newTestSession(t, db, auth.PermissionModifyItem)

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
	_, token := newTestSession(t, db, auth.PermissionDeleteItem)

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

	response := makeRequest(router, http.MethodDelete, "/items/"+testItemToRemove.ID.String(), "", token)

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

func TestAddCategory(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	body := `{
		"categoryName": "TestCategory1"
	}`

	response := makeRequest(router, http.MethodPost, "/categories", body, adminToken)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusCreated)

	var result struct {
		ItemCategory inventory.ItemCategory `json:"itemCategory"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode category created: %v", err)
	}

	var addedItemCategory inventory.ItemCategory

	// Ensure category was successfully added to the database
	if err := db.First(&addedItemCategory, "id = ?", result.ItemCategory.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure the name matches
	if addedItemCategory.CategoryName != "TestCategory1" {
		t.Errorf("Expected Name: TestCategory1 | Actual Value: %q", addedItemCategory.CategoryName)
	}
}

func TestAddSubCategory(t *testing.T) {
	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	testParentCategory := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "TestParentCategory",
	}

	if err := db.Create(&testParentCategory).Error; err != nil {
		t.Fatal(err)
	}

	body := `{
		"categoryName": "TestSubCategory1",
		"parentID": "` + testParentCategory.ID.String() + `"
	}`

	response := makeRequest(router, http.MethodPost, "/categories", body, adminToken)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusCreated)

	var result struct {
		ItemCategory inventory.ItemCategory `json:"itemCategory"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode category created: %v", err)
	}

	var addedSubCategory inventory.ItemCategory

	// Ensure category was successfully added to the database
	if err := db.Preload("ParentCategory").First(&addedSubCategory, "id = ?", result.ItemCategory.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure the name matches
	if addedSubCategory.CategoryName != "TestSubCategory1" {
		t.Errorf("Expected Name: TestSubCategory1 | Actual Value: %q", addedSubCategory.CategoryName)
	}

	var retrievedParent = *addedSubCategory.ParentCategory

	if retrievedParent.CategoryName != "TestParentCategory" {
		t.Errorf("Expected Name: TestParentCategory | Actual Value: %q", retrievedParent.CategoryName)
	}
}

func TestAddItemWithCategory(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	testCategory1 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory1",
	}

	if err := db.Create(&testCategory1).Error; err != nil {
		t.Fatal(err)
	}

	testCategory2 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory2",
	}

	if err := db.Create(&testCategory2).Error; err != nil {
		t.Fatal(err)
	}

	body := `{
		"itemName": "TestItem1",
		"quantity": 1,
		"manufacturer": "TestCompany",
		"manufacturerPart": "A1",
		"categories": [
			"` + testCategory1.ID.String() + `", 
			"` + testCategory2.ID.String() + `"
		],
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
	if err := db.Preload("Categories").First(&addedItem, "id = ?", result.Item.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}
	// Ensure the categories are correct
	if !slices.ContainsFunc(addedItem.Categories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory1.ID
	}) {
		t.Errorf("Couldn't find testCategory1 ID")
	}
	if !slices.ContainsFunc(addedItem.Categories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory2.ID
	}) {
		t.Errorf("Couldn't find testCategory2 ID")
	}
}

func TestAttachCategoryByUpdatingItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

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

	testCategory1 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory1",
	}

	if err := db.Create(&testCategory1).Error; err != nil {
		t.Fatal(err)
	}

	testCategory2 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory2",
	}

	if err := db.Create(&testCategory2).Error; err != nil {
		t.Fatal(err)
	}

	body := `{
		"categories": [
			"` + testCategory1.ID.String() + `", 
			"` + testCategory2.ID.String() + `"
		]
	}`

	response := makeRequest(router, http.MethodPut, "/items/"+testItemToEdit.ID.String(), body, adminToken)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusOK)

	var result struct {
		Item inventory.Item `json:"item"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item created: %v", err)
	}

	var editedItem inventory.Item

	// Ensure Item was successfully added to the database
	if err := db.Preload("Categories").First(&editedItem, "id = ?", result.Item.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure the categories are correct
	if !slices.ContainsFunc(editedItem.Categories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory1.ID
	}) {
		t.Errorf("Couldn't find testCategory1 ID")
	}
	if !slices.ContainsFunc(editedItem.Categories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory2.ID
	}) {
		t.Errorf("Couldn't find testCategory2 ID")
	}

	// Ensure the other properties of the item haven't been modified
	if editedItem.ItemName != "TestItem1" {
		t.Errorf("Expected Name: TestItem1 | Actual Value: %q", editedItem.ItemName)
	}
	if editedItem.Quantity != 1 {
		t.Errorf("Expected Quantity: 1 | Actual Value: %d", editedItem.Quantity)
	}
	if editedItem.Manufacturer != "TestCompany" {
		t.Errorf("Expected Manufacturer: TestCompany | Actual Value: %q", editedItem.Manufacturer)
	}
	if editedItem.ManufacturerPart != "A1" {
		t.Errorf("Expected ManufacturerPart: A1 | Actual Value: %q", editedItem.ManufacturerPart)
	}
}

func TestAttachInvalidCategory(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

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

	testCategory1 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory1",
	}

	if err := db.Create(&testCategory1).Error; err != nil {
		t.Fatal(err)
	}

	testCategory2 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory2",
	}

	if err := db.Create(&testCategory2).Error; err != nil {
		t.Fatal(err)
	}

	// Have random UUID in the body for testCategory2
	body := `{
		"categories": [
			"` + testCategory1.ID.String() + `", 
			"` + uuid.New().String() + `" 
		]
	}`

	response := makeRequest(router, http.MethodPut, "/items/"+testItemToEdit.ID.String(), body, adminToken)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusBadRequest)

	var result struct {
		Error string `json:"error"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item created: %v", err)
	}

	if result.Error != "Adding tag that wasn't found in the database" {
		t.Fatalf("Incorrect error message, Expected (Adding tag that wasn't found in the database) | Actual response error message: %s", result.Error)
	}
}

func TestNoNewFieldsItem(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	testCategory1 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory1",
	}

	if err := db.Create(&testCategory1).Error; err != nil {
		t.Fatal(err)
	}

	testCategory2 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory2",
	}

	if err := db.Create(&testCategory2).Error; err != nil {
		t.Fatal(err)
	}

	testItemToEdit := inventory.Item{
		ID:               uuid.New(),
		ItemName:         "TestItem1",
		Quantity:         1,
		Manufacturer:     "TestCompany",
		ManufacturerPart: "A1",
		Categories:       []inventory.ItemCategory{testCategory1, testCategory2},
	}

	if err := db.Create(&testItemToEdit).Error; err != nil {
		t.Fatal(err)
	}

	// Body is empty
	body := `{
	}`

	response := makeRequest(router, http.MethodPut, "/items/"+testItemToEdit.ID.String(), body, adminToken)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusBadRequest)

	var result struct {
		Error string `json:"error"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item created: %v", err)
	}

	if result.Error != "No item fields provided for update" {
		t.Fatalf("Incorrect error message, Expected (No item fields provided for update) | Actual response error message: %s", result.Error)
	}

	var unEditedItem inventory.Item

	// Ensure Item was successfully added to the database
	if err := db.Preload("Categories").First(&unEditedItem, "id = ?", testItemToEdit.ID).Error; err != nil {
		t.Fatalf("Created item wasn't found in the database: %v", err)
	}

	// Ensure the categories are correct
	if !slices.ContainsFunc(unEditedItem.Categories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory1.ID
	}) {
		t.Errorf("Couldn't find testCategory1 ID")
	}
	if !slices.ContainsFunc(unEditedItem.Categories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory2.ID
	}) {
		t.Errorf("Couldn't find testCategory2 ID")
	}

	// Ensure the other properties of the item haven't been modified
	if unEditedItem.ItemName != "TestItem1" {
		t.Errorf("Expected Name: TestItem1 | Actual Value: %q", unEditedItem.ItemName)
	}
	if unEditedItem.Quantity != 1 {
		t.Errorf("Expected Quantity: 1 | Actual Value: %d", unEditedItem.Quantity)
	}
	if unEditedItem.Manufacturer != "TestCompany" {
		t.Errorf("Expected Manufacturer: TestCompany | Actual Value: %q", unEditedItem.Manufacturer)
	}
	if unEditedItem.ManufacturerPart != "A1" {
		t.Errorf("Expected ManufacturerPart: A1 | Actual Value: %q", unEditedItem.ManufacturerPart)
	}
}

func TestGetCategories(t *testing.T) {

	router, db := newAuthRouter(t)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	testCategory1 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory1",
	}

	if err := db.Create(&testCategory1).Error; err != nil {
		t.Fatal(err)
	}

	testCategory2 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory2",
	}

	if err := db.Create(&testCategory2).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/categories", "", adminToken)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusOK)

	var retrievedCategories []inventory.ItemCategory

	if err := db.Find(&retrievedCategories).Error; err != nil {
		t.Fatalf("Error while trying to retrieve categories: %v", err)
	}

	// Ensure Categories are successfully retrieved
	if !slices.ContainsFunc(retrievedCategories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory1.ID
	}) {
		t.Errorf("Couldn't find testCategory1 ID")
	}
	if !slices.ContainsFunc(retrievedCategories, func(category inventory.ItemCategory) bool {
		return category.ID == testCategory2.ID
	}) {
		t.Errorf("Couldn't find testCategory2 ID")
	}
}

func TestGetCategoryByID(t *testing.T) {

	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, "View")

	testCategory1 := inventory.ItemCategory{
		ID:           uuid.New(),
		CategoryName: "testCategory1",
	}

	if err := db.Create(&testCategory1).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodGet, "/categories/"+testCategory1.ID.String(), "", token)

	// Ensure HTTP response is correct
	requireStatus(t, response, http.StatusOK)

	var result struct {
		Category inventory.ItemCategory `json:"itemCategory"`
	}

	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatalf("Can't decode item created: %v", err)
	}

	var retrievedCategory inventory.ItemCategory

	// Ensure category was successfullly added to the database
	if err := db.First(&retrievedCategory, "id = ?", result.Category.ID).Error; err != nil {
		t.Fatalf("Created category wasn't found in the database: %v", err)
	}

	// Ensure the properties of the retrieved category match all the properties of the one added to the database
	if retrievedCategory.CategoryName != "testCategory1" {
		t.Errorf("Expected Name: testCategory1 | Actual Value: %q", retrievedCategory.CategoryName)
	}
}

func TestInventoryRequiresPermissions(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db)
	path := "/items/" + uuid.New().String()

	response := makeRequest(router, http.MethodPost, "/items",
		`{"itemName":"Test item","quantity":1,"manufacturer":"TestCompany","manufacturerPart":"A1"}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodPut, path, `{"quantity":2}`, token)
	requireStatus(t, response, http.StatusForbidden)

	response = makeRequest(router, http.MethodDelete, path, "", token)
	requireStatus(t, response, http.StatusForbidden)
}

func TestAdministratorCanModifyItem(t *testing.T) {
	router, db := newAuthRouter(t)
	_, token := newTestSession(t, db, auth.PermissionAdministrator)
	item := inventory.Item{
		ID: uuid.New(), ItemName: "Test item", Quantity: 1,
		Manufacturer: "TestCompany", ManufacturerPart: "A1",
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodPut, "/items/"+item.ID.String(), `{"quantity":2}`, token)
	requireStatus(t, response, http.StatusOK)
	if err := db.First(&item, "id = ?", item.ID).Error; err != nil {
		t.Fatal(err)
	}
	if item.Quantity != 2 {
		t.Errorf("Expected quantity 2, got %d", item.Quantity)
	}
}

func TestDisabledUserCannotModifyItem(t *testing.T) {
	router, db := newAuthRouter(t)
	user, token := newTestSession(t, db, auth.PermissionModifyItem)
	if err := db.Model(&user).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}

	response := makeRequest(router, http.MethodPut, "/items/"+uuid.New().String(), `{"quantity":2}`, token)
	requireStatus(t, response, http.StatusForbidden)
}
