package inventory

import (
	"sort"
	"strconv"
	"strings"
)

func itemChanges(before, after Item) []FieldChange {
	changes := make([]FieldChange, 0)
	add := func(field, previous, current string) {
		if previous != current {
			changes = append(changes, FieldChange{Field: field, Before: previous, After: current})
		}
	}
	threshold := func(item Item) string {
		if item.LowStockThreshold == nil {
			return "10"
		}
		return strconv.FormatInt(int64(*item.LowStockThreshold), 10)
	}
	categories := func(item Item) string {
		names := make([]string, 0, len(item.Categories))
		for _, category := range item.Categories {
			names = append(names, category.CategoryName)
		}
		sort.Strings(names)
		return strings.Join(names, ", ")
	}

	add("Name", before.ItemName, after.ItemName)
	add("Quantity", strconv.FormatInt(int64(before.Quantity), 10), strconv.FormatInt(int64(after.Quantity), 10))
	add("Low stock threshold", threshold(before), threshold(after))
	add("Manufacturer", before.Manufacturer, after.Manufacturer)
	add("Manufacturer part", before.ManufacturerPart, after.ManufacturerPart)
	add("Distributor part", before.DistributorPart, after.DistributorPart)
	add("Distributor URL", before.DistributorURL, after.DistributorURL)
	add("Datasheet URL", before.DataSheetURL, after.DataSheetURL)
	add("Description", before.Description, after.Description)
	add("Categories", categories(before), categories(after))
	return changes
}
