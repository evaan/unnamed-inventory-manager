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
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	newItem := createNewItem(req)
	if len(newItem) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No item fields provided for update",
		})
		return
	}

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
