package tests

import (
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"testing"
	"time"
	"uuid"

	"gorm.io/gorm"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
)

func TestInventoryReadsRequireActiveSession(t *testing.T) {
	router, db := newAuthRouter(t)
	_, activeToken := newTestSession(t, db)
	disabled, disabledToken := newTestSession(t, db, auth.PermissionAdministrator)
	if err := db.Model(&disabled).Update("disabled", true).Error; err != nil {
		t.Fatal(err)
	}
	_, expiredToken := newTestSession(t, db)
	if err := db.Model(&auth.UserSession{}).
		Where("session_token = ?", auth.HashToken(expiredToken)).
		Update("expires", time.Now().Add(-time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
	category := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Private category"}
	item := inventory.Item{ID: uuid.New(), ItemName: "Private item"}
	if err := db.Create(&category).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{"/items", "/items/" + item.ID.String(), "/categories", "/categories/" + category.ID.String(), "/logs"} {
		t.Run(path, func(t *testing.T) {
			for _, test := range []struct {
				name   string
				token  string
				status int
			}{
				{"anonymous", "", http.StatusUnauthorized},
				{"invalid", "invalid-session", http.StatusUnauthorized},
				{"expired", expiredToken, http.StatusUnauthorized},
				{"disabled", disabledToken, http.StatusForbidden},
				{"active", activeToken, http.StatusOK},
			} {
				t.Run(test.name, func(t *testing.T) {
					requireStatus(t, makeRequest(router, http.MethodGet, path, "", test.token), test.status)
				})
			}
		})
	}
}

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

func TestCreateAndDeleteCategory(t *testing.T) {
	router, db := newAuthRouter(t)
	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatal(err)
	}
	_, createToken := newTestSession(t, db, auth.PermissionCreateTag)
	_, deleteToken := newTestSession(t, db, auth.PermissionDeleteTag)
	_, adminToken := newTestSession(t, db, auth.PermissionAdministrator)

	const body = `{"categoryName":"TestCategory1"}`
	requireStatus(t, makeRequest(router, http.MethodPost, "/categories", body, ""), http.StatusUnauthorized)
	requireStatus(t, makeRequest(router, http.MethodPost, "/categories", body, deleteToken), http.StatusForbidden)
	response := makeRequest(router, http.MethodPost, "/categories", body, createToken)
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

	child := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Child", ParentID: &addedItemCategory.ID}
	if err := db.Create(&child).Error; err != nil {
		t.Fatal(err)
	}
	item := inventory.Item{
		ID: uuid.New(), ItemName: "Test item", Manufacturer: "Test company", ManufacturerPart: "A1",
		Categories: []inventory.ItemCategory{addedItemCategory, child},
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}

	path := "/categories/" + addedItemCategory.ID.String()
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", ""), http.StatusUnauthorized)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", createToken), http.StatusForbidden)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", deleteToken), http.StatusNoContent)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", deleteToken), http.StatusNotFound)

	var remaining inventory.Item
	if err := db.Preload("Categories").First(&remaining, "id = ?", item.ID).Error; err != nil {
		t.Fatal(err)
	}
	if len(remaining.Categories) != 1 || remaining.Categories[0].ID != child.ID || remaining.Categories[0].ParentID != nil {
		t.Errorf("Expected the child to remain linked to the item as a top-level category, got %+v", remaining.Categories)
	}
	requireStatus(t, makeRequest(router, http.MethodDelete, "/categories/"+child.ID.String(), "", adminToken), http.StatusNoContent)
}

func TestDeleteNestedCategory(t *testing.T) {
	router, db := newAuthRouter(t)
	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatal(err)
	}
	_, token := newTestSession(t, db, auth.PermissionDeleteTag)

	top := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Top"}
	middle := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Middle", ParentID: &top.ID}
	bottom := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Bottom", ParentID: &middle.ID}
	sibling := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Sibling", ParentID: &middle.ID}
	descendant := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Descendant", ParentID: &bottom.ID}
	for _, category := range []*inventory.ItemCategory{&top, &middle, &bottom, &sibling, &descendant} {
		if err := db.Create(category).Error; err != nil {
			t.Fatal(err)
		}
	}
	item := inventory.Item{
		ID: uuid.New(), ItemName: "Test item", Manufacturer: "Test company", ManufacturerPart: "A1",
		Categories: []inventory.ItemCategory{middle, bottom},
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatal(err)
	}

	path := "/categories/" + middle.ID.String()
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", token), http.StatusNoContent)
	requireStatus(t, makeRequest(router, http.MethodDelete, path, "", token), http.StatusNotFound)

	for _, child := range []inventory.ItemCategory{bottom, sibling} {
		var remaining inventory.ItemCategory
		if err := db.First(&remaining, "id = ?", child.ID).Error; err != nil {
			t.Fatal(err)
		}
		if remaining.ParentID == nil || *remaining.ParentID != top.ID {
			t.Errorf("Expected %s to remain nested under Top, got %+v", child.CategoryName, remaining)
		}
	}
	var remainingDescendant inventory.ItemCategory
	if err := db.First(&remainingDescendant, "id = ?", descendant.ID).Error; err != nil {
		t.Fatal(err)
	}
	if remainingDescendant.ParentID == nil || *remainingDescendant.ParentID != bottom.ID {
		t.Fatal("Expected deeper descendants to keep their existing parent")
	}
	var remainingItem inventory.Item
	if err := db.Preload("Categories").First(&remainingItem, "id = ?", item.ID).Error; err != nil {
		t.Fatal(err)
	}
	if len(remainingItem.Categories) != 1 || remainingItem.Categories[0].ID != bottom.ID {
		t.Fatalf("Expected only the deleted category to be removed from the item, got %+v", remainingItem.Categories)
	}
	if remainingItem.Categories[0].ParentID == nil || *remainingItem.Categories[0].ParentID != top.ID {
		t.Fatal("Expected the item's bottom category to be nested under Top")
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

	_, createToken := newTestSession(t, db, auth.PermissionCreateTag)
	_, modifyToken := newTestSession(t, db, auth.PermissionModifyItem)
	childPath := "/categories/" + addedSubCategory.ID.String()
	parentPath := "/categories/" + testParentCategory.ID.String()
	const topLevel = `{"parentID":null}`
	requireStatus(t, makeRequest(router, http.MethodPatch, childPath, topLevel, modifyToken), http.StatusForbidden)
	requireStatus(t, makeRequest(router, http.MethodPatch, childPath, `{}`, createToken), http.StatusBadRequest)
	requireStatus(t, makeRequest(router, http.MethodPatch, childPath, `{"parentID":"`+uuid.New().String()+`"}`, createToken), http.StatusNotFound)
	requireStatus(t, makeRequest(router, http.MethodPatch, parentPath, `{"parentID":"`+addedSubCategory.ID.String()+`"}`, createToken), http.StatusBadRequest)

	requireStatus(t, makeRequest(router, http.MethodPatch, childPath, topLevel, adminToken), http.StatusNoContent)
	var moved inventory.ItemCategory
	if err := db.First(&moved, "id = ?", addedSubCategory.ID).Error; err != nil {
		t.Fatal(err)
	}
	if moved.ParentID != nil {
		t.Fatal("Expected the category to become top-level")
	}

	requireStatus(t, makeRequest(router, http.MethodPatch, childPath, `{"parentID":"`+testParentCategory.ID.String()+`"}`, createToken), http.StatusNoContent)
	if err := db.First(&moved, "id = ?", addedSubCategory.ID).Error; err != nil {
		t.Fatal(err)
	}
	if moved.ParentID == nil || *moved.ParentID != testParentCategory.ID {
		t.Fatal("Expected the category to move under the selected parent")
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

	itemPath := "/items/" + testItemToEdit.ID.String()
	editedItem := result.Item
	response = makeRequest(router, http.MethodGet, itemPath, "", adminToken)
	requireStatus(t, response, http.StatusOK)
	result.Item = inventory.Item{}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	response = makeRequest(router, http.MethodGet, "/items", "", adminToken)
	requireStatus(t, response, http.StatusOK)
	var list struct {
		Items []inventory.Item `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("Expected one item, got %d", len(list.Items))
	}
	for _, item := range []inventory.Item{editedItem, result.Item, list.Items[0]} {
		if len(item.Categories) != 2 ||
			!slices.Contains(item.Categories, testCategory1) ||
			!slices.Contains(item.Categories, testCategory2) {
			t.Errorf("Expected both categories, got %+v", item.Categories)
		}
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

	for _, update := range []struct {
		body  string
		count int
	}{
		{`{"quantity":2}`, 2},
		{`{"categories":[]}`, 0},
	} {
		response = makeRequest(router, http.MethodPut, itemPath, update.body, adminToken)
		requireStatus(t, response, http.StatusOK)
		result.Item = inventory.Item{}
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Item.Categories == nil || len(result.Item.Categories) != update.count {
			t.Errorf("Expected an array of %d categories after %s, got %#v", update.count, update.body, result.Item.Categories)
		}
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

	if result.Error != "Category not found" {
		t.Fatalf("Expected Category not found, got %q", result.Error)
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
