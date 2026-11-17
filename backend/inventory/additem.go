package inventory

import (
	"net/http"
	"time"
	"uuid"

	"github.com/evaandev/unnamed-inventory-manager/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Add item
// @Description	Adds item to inventory
// @Tags			Item
// @Accept			json
// @Param			body	body	CreateItemReq	true	"Item information (name, quantity, manufacturer, etc.)"
// @Success		201		"Item created"
// @Failure		400		"Invalid request body"
// @Failure		500		"Error creating item or log"
// @Router			/items [post]
func AddItem(c *gin.Context, db *gorm.DB) {
	user, err := auth.GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	hasPermission, err := auth.HasPermission(db.WithContext(c.Request.Context()), user, auth.PermissionCreateItem)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	if !hasPermission {
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	// TODO: make creation of log and item one db transaction
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

	if req.Categories != nil {

		var categories []ItemCategory

		if err := db.Where("id IN ?", *req.Categories).Find(&categories).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Error retrieving categories for items",
			})
			return
		}

		databaseIDS := make(map[uuid.UUID]bool)

		for _, category := range categories {
			databaseIDS[category.ID] = true
		}

		for _, reqID := range *req.Categories {
			if !databaseIDS[reqID] {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Adding category that wasn't found in the database",
				})
				return
			}
		}

		newItem.Categories = categories
	}

	if err := db.Create(&newItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create item",
		})
		return
	}

	// Add to changelog
	log := Changelog{
		UserID:      uuid.UUID(user.ID),
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
