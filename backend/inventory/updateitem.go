package inventory

import (
	"errors"
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gopkg.in/gomail.v2"
	"gorm.io/gorm"
)

// @Summary		Update item
// @Description	Update item information
// @Tags			Item
// @Accept			json
// @Param			id		path	string				true	"Item ID"	Format(uuid)
// @Param			body	body	UpdateItemReq	true	"Item information to be updated (name, quantity, manufacturer, etc.). Only changed files are necessary"
// @Success		200		"Item updated (returns object)"
// @Success 	202		"Item has been requested but needs to be approved by an admin"
// @Failure		400		"Invalid item id, invalid request body, empty request body"
// @Failure		404		"Item not found, failure to update item or create log, fail to retrieve modified item"
// @Failure		500		"Failed to retrieve item, "
// @Router			/items/{id} [put]
func UpdateItem(c *gin.Context, db *gorm.DB, eDialer *gomail.Dialer) {
	user, err := auth.GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// TODO: create one transaction between both update of item and log creation

	//Update item by id
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No item selected",
		})
		return
	}
	itemid, err := uuid.Parse(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid item ID",
		})
		return
	}

	var item Item
	if err := db.First(&item, "id = ?", itemid).Error; err != nil {
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

	if req.Quantity == nil {
		req.Quantity = &item.Quantity
	}

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

	newItem := createNewItem(req)
	if len(newItem) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No item fields provided for update",
		})
		return
	}

	isAdmin, err := auth.IsAdmin(db.WithContext(c.Request.Context()), user)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	if item.NeedRequest && !isAdmin {
		CreateRequest(c, user, item, req, deltaQ, action, db, eDialer)
		return
	}

	ModifyItem(c, db, uuid.UUID(user.ID), item, newItem, deltaQ, action, req.LogDescription)
}
