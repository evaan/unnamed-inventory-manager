package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/evaandev/unnamed-inventory-manager/inventory"
)

func TestChangelogShowsItemAndUser(t *testing.T) {
	router, db := newAuthRouter(t)
	_, readerToken := newTestSession(t, db)
	creator, createToken := newTestSession(t, db, auth.PermissionCreateItem)

	const body = `{"itemName":"Resistor","quantity":5,"manufacturer":"Yageo","manufacturerPart":"R1","logDescription":"Initial stock"}`
	response := makeRequest(router, http.MethodPost, "/items", body, createToken)
	requireStatus(t, response, http.StatusCreated)

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
	if len(result.Items) != 1 {
		t.Fatalf("Expected one log entry, got %+v", result.Items)
	}
	entry := result.Items[0]
	if entry.Action != inventory.ItemCreated || entry.Quantity != 5 || entry.Description != "Initial stock" {
		t.Errorf("Unexpected log entry: %+v", entry)
	}
	if entry.UserID.String() != creator.ID.String() || entry.UserName != creator.Name || entry.Item.ItemName != "Resistor" || entry.ChangeTime.IsZero() {
		t.Errorf("Expected the item, acting user and timestamp, got %+v", entry)
	}
}
