package inventory

func createNewItem(req UpdateItemReq) map[string]interface{} {
	newItem := map[string]interface{}{}

	if req.ItemName != nil {
		newItem["item_name"] = *req.ItemName
	}
	if req.Quantity != nil {
		newItem["quantity"] = *req.Quantity
	}
	if req.Manufacturer != nil {
		newItem["manufacturer"] = *req.Manufacturer
	}
	if req.ManufacturerPart != nil {
		newItem["manufacturer_part"] = *req.ManufacturerPart
	}
	if req.DistributorPart != nil {
		newItem["distributor_part"] = *req.DistributorPart
	}
	if req.DistributorURL != nil {
		newItem["distributor_url"] = *req.DistributorURL
	}
	if req.ItemDescription != nil {
		newItem["description"] = *req.ItemDescription
	}
	if req.DataSheetURL != nil {
		newItem["data_sheet_url"] = *req.DataSheetURL
	}
	if req.LogDescription != nil {
		newItem["log_description"] = *req.LogDescription
	} else {
		newItem["log_description"] = ""
	}

	return newItem
}
