package inventory

import (
	"errors"
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/email"
	"gopkg.in/gomail.v2"
	"gorm.io/gorm"
)

// @Summary		Update item
// @Description	Update item information
// @Tags			Item
// @Accept			json
// @Param			id		path	string				true	"Item ID"	Format(uuid)
// @Success		200		"Item updated (returns object)"
// @Failure		500		"Failed to retrieve item, "
// @Router			/items/{id} [put]
func UpdateRequest(c *gin.Context, db *gorm.DB, eDialer *gomail.Dialer) {
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

	var itemRequest Request
	if err := db.First(&itemRequest, "id = ?", itemid).Error; err != nil {
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

	var req UpdateRequestForItem
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	var deltaQ int32
	if itemRequest.ProposedQuantity == nil {
		deltaQ = itemRequest.OldQuantity
	} else {
		deltaQ = *itemRequest.ProposedQuantity - itemRequest.OldQuantity
	}

	newItem := createNewItem(UpdateItemReq{
		ItemName:         itemRequest.ProposedItemName,
		Quantity:         itemRequest.ProposedQuantity,
		Manufacturer:     itemRequest.ProposedManufacturer,
		ManufacturerPart: itemRequest.ProposedManufacturerPart,
		DistributorPart:  itemRequest.ProposedDistributorPart,
		DistributorURL:   itemRequest.ProposedDistributorURL,
		ItemDescription:  itemRequest.ProposedItemDescription,
		DataSheetURL:     itemRequest.ProposedDataSheetURL,
		LogDescription:   itemRequest.Description})

	newRequest := itemRequest
	if !req.ChangeAuthorized {
		newRequest.Approved = RequestDenied
		// TODO: set real values
		email.SendEmail(eDialer, "aw", "", "", "Your request for this item has been denied", "")
	} else {
		// request set as approved
		// change is done to item
		// email is sent to user
		// change log is updated
		newRequest.Approved = RequestApproved
		ModifyItem(c, db, itemRequest.UserID, itemRequest.Item, newItem, deltaQ, itemRequest.Action, itemRequest.Description)
		email.SendEmail(eDialer, "aw", "", "", "Your request for this item has been approved", "")
	}

	if err := db.Model(&itemRequest).Updates(newRequest).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update item",
		})
		return
	}

	c.JSON(http.StatusNoContent, gin.H{})
}
