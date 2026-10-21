package inventory

import (
	"errors"
	"net/http"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Update item
// @Description	Update item information
// @Tags			Item
// @Accept			json
// @Param			id		path	string				true	"Item ID"	Format(uuid)
// @Param			body	body	UpdateItemReq	true	"Item information to be updated (name, quantity, manufacturer, etc.). Only changed files are necessary"
// @Success		200		"Item updated (returns object)"
// @Failure		400		"Invalid item id, invalid request body, empty request body"
// @Failure		404		"Item not found, failure to update item or create log, fail to retrieve modified item"
// @Failure		500		"Failed to retrieve item, "
// @Router			/items/{id} [put]
func UpdateItem(c *gin.Context, db *gorm.DB) {
	// TODO: add real uuid for User in changelog
	// TODO: create one transaction between both update of item and log creation

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
	if err := db.First(&item, "id = ?", id).Error; err != nil {
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

	if req.LogDescription == nil {
		req.LogDescription = new(string)
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
	if err := db.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve updated item",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"item": item,
	})
}
