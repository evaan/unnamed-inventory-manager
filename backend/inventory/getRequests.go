package inventory

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gitlab.com/evaandev/unnamed-inventory-manager/auth"
	"gorm.io/gorm"
)

// @Summary		Get Requests
// @Description	Get requests information
// @Tags			Item
// @Accept			json
// @Param			id		path	string				true	"Item ID"	Format(uuid)
// @Success		200		"Item updated (returns object)"
// @Failure		500		"Failed to retrieve item, "
// @Router			/requests [get]
func GetRequests(c *gin.Context, db *gorm.DB) {
	user, err := auth.GetUser(c)
	if err != nil {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	isAdmin, err := auth.IsAdmin(db.WithContext(c.Request.Context()), user)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	if !isAdmin {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var requests []Request

	if err := db.Find(&requests).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Error retrieving item information",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": requests,
	})
}
