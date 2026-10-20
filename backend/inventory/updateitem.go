package inventory

import (
	"errors"
	"net/http"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TODO: add real uuid for User in changelog
// TODO: create one transaction between both update of item and log creation
func UpdateItem(c *gin.Context, db *gorm.DB) {
	//Update item by id

	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No item selected",
		})
		return
	}
	var itemid, err = uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid item ID",
		})
		return
	}

	var item Item
	if err := db.First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Item not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve item",
		})
		return
	}
	oldQuantity := item.Quantity

	var req UpdateItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{
			"error": err.Error(),
		})
		return
	}

	newItem := createNewItem(req)
	if req.Quantity == nil {
		req.Quantity = &item.Quantity
	}

	if err := db.Model(&item).Updates(newItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update item",
		})
		return
	}

	// Add to changelog
	deltaQ := *req.Quantity - oldQuantity
	action := ItemModified
	if deltaQ > 0 {
		action = ItemAdded
	} else if deltaQ < 0 {
		action = ItemTaken
	}

	// TODO: add real uuid for User
	log := Changelog{
		UserID:      uuid.New(),
		ItemID:      itemid,
		Quantity:    deltaQ,
		Action:      action,
		ChangeTime:  time.Now(),
		Description: *req.LogDescription}

	if err := db.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create changelog",
		})
		return
	}

	// Return item
	if err := db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve item",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"item": item,
	})
}

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
		newItem["data_sheet_url"] = *req.LogDescription
	}

	return newItem
}
