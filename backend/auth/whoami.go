package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func WhoAmI(c *gin.Context, db *gorm.DB) {
	user, err := GetUser(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"loggedIn": false})
		return
	}

	permissions, err := GetUserPermissions(db.WithContext(c.Request.Context()), user.ID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"loggedIn":    true,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": permissions,
	})
}
