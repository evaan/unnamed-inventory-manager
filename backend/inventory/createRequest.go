package inventory

import (
	"net/http"
	"time"
	"uuid"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gopkg.in/gomail.v2"
	"gorm.io/gorm"
)

func CreateRequest(c *gin.Context, user *auth.User, item Item, req UpdateItemReq, deltaQ int32, action ChangelogAction, db *gorm.DB, eDialer *gomail.Dialer) {
	// add request to request table
	itemRequest := Request{
		UserID:                   uuid.UUID(user.ID),
		ItemID:                   item.ID,
		Action:                   action,
		ProposedQuantity:         req.Quantity,
		ProposedItemName:         req.ItemName,
		ProposedManufacturer:     req.Manufacturer,
		ProposedManufacturerPart: req.ManufacturerPart,
		ProposedDistributorPart:  req.DistributorPart,
		ProposedDistributorURL:   req.DistributorURL,
		ProposedDataSheetURL:     req.DataSheetURL,
		ProposedItemDescription:  req.ItemDescription,
		ChangeTime:               time.Now(),
		Approved:                 RequestPending,
		Description:              req.LogDescription,
	}

	if err := db.Create(&itemRequest).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create item request",
		})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{
		"request": itemRequest,
	})

	// send email to admin
	// email.SendEmail(eDialer, "aw", "", "", "Please answer to this request of this person to this item", "")
}
