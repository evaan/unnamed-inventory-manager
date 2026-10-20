package inventory

import (
	"net/http"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// TODO: add real uuid for User
// TODO: make creation of log and item one db transaction
func AddItem(c *gin.Context, db *gorm.DB) {
	var req CreateItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	newItem := Item{
		ID:               uuid.New(),
		ItemName:         req.ItemName,
		Quantity:         *req.Quantity,
		Manufacturer:     req.Manufacturer,
		ManufacturerPart: req.ManufacturerPart,
		DistributorPart:  req.DistributorPart,
		DistributorURL:   req.DistributorURL,
		DataSheetURL:     req.DataSheetURL,
		Description:      req.Description}

	if err := db.Create(&newItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create item",
		})
		return
	}

	// Add to changelog
	// TODO: add real uuid for User
	log := Changelog{
		UserID:      uuid.New(),
		ItemID:      newItem.ID,
		Quantity:    *req.Quantity,
		Action:      ItemCreated,
		ChangeTime:  time.Now(),
		Description: req.LogDescription}

	if err := db.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create changelog",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"item": newItem,
	})
}
