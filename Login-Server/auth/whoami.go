package auth

import (
	"net/http"

	"github.com/evaan/unnamed-inventory-manager/util"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func WhoAmI(c *gin.Context, db *gorm.DB) {
	u, exists := c.Get("user")
	if !exists || u == nil {
		c.JSON(http.StatusOK, gin.H{"loggedIn": false})
		return
	}

	user := u.(*util.User)

	perms := make([]util.UserPermission, 0)
	if err := db.Where("user_id = ?", user.ID).Find(&perms).Error; err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	permissions := make([]string, 0, len(perms))
	for _, p := range perms {
		permissions = append(permissions, p.Permission)
	}

	c.JSON(http.StatusOK, gin.H{
		"loggedIn":    true,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": permissions,
	})
}
