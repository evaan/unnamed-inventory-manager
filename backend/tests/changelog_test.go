package tests

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
	"uuid"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
)

func TestChangelogShowsItemChangesAndUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, readerToken := newTestSession(t, db)
	creator, createToken := newTestSession(t, db, auth.PermissionCreateItem, auth.PermissionModifyItem)

	const body = `{"itemName":"Resistor","quantity":5,"manufacturer":"Yageo","manufacturerPart":"R1","logDescription":"Initial stock"}`
	response := makeRequest(router, http.MethodPost, "/items", body, createToken)
	requireStatus(t, response, http.StatusCreated)
	var created struct {
		Item inventory.Item `json:"item"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	category := inventory.ItemCategory{ID: uuid.New(), CategoryName: "Resistors"}
	if err := db.Create(&category).Error; err != nil {
		t.Fatal(err)
	}
	update := `{"quantity":8,"lowStockThreshold":4,"itemDescription":"Labelled stock","categories":["` + category.ID.String() + `"],"logDescription":"Restocked"}`
	requireStatus(t, makeRequest(router, http.MethodPut, "/items/"+created.Item.ID.String(), update, createToken), http.StatusOK)

	response = makeRequest(router, http.MethodGet, "/logs", "", readerToken)
	requireStatus(t, response, http.StatusOK)
	var result struct {
		Items []struct {
			inventory.Changelog
			UserName string
		} `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 2 {
		t.Fatalf("Expected two log entries, got %+v", result.Items)
	}
	entry := result.Items[0]
	if entry.Action != inventory.ItemAdded || entry.Quantity != 3 || entry.Description != "Restocked" {
		t.Errorf("Unexpected log entry: %+v", entry)
	}
	if entry.UserID.String() != creator.ID.String() || entry.UserName != creator.Name || entry.Item.ItemName != "Resistor" || entry.ChangeTime.IsZero() {
		t.Errorf("Expected the item, acting user and timestamp, got %+v", entry)
	}
	expectedChanges := []inventory.FieldChange{
		{Field: "Quantity", Before: "5", After: "8"},
		{Field: "Low stock threshold", Before: "10", After: "4"},
		{Field: "Description", Before: "", After: "Labelled stock"},
		{Field: "Categories", Before: "", After: "Resistors"},
	}
	if !reflect.DeepEqual(entry.Changes, expectedChanges) {
		t.Errorf("Expected field changes %+v, got %+v", expectedChanges, entry.Changes)
	}
	if result.Items[1].Action != inventory.ItemCreated || result.Items[1].Description != "Initial stock" {
		t.Errorf("Expected the older creation entry to remain available, got %+v", result.Items[1])
	}
}
