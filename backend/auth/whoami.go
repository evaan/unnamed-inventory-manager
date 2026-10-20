package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get the current user
// @Description	Returns login status and disabled status. Enabled users also receive their name, email and permissions
// @Tags			Auth
// @Produce		json
// @Success		200	{object}	object{loggedIn=bool,disabled=bool,name=string,email=string,permissions=[]string}	"Login status and user details"
// @Failure		500	"Error getting current user"
// @Router			/whoami [get]
func WhoAmI(c *gin.Context, db *gorm.DB) {
	c.Header("Cache-Control", "no-store")
	user, err := GetUser(c)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"loggedIn": false})
		return
	}

	if user.Disabled {
		c.JSON(http.StatusOK, gin.H{"loggedIn": true, "disabled": true})
		return
	}

	permissions, err := GetUserPermissions(db.WithContext(c.Request.Context()), user.ID)
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"loggedIn":    true,
		"disabled":    false,
		"name":        user.Name,
		"email":       user.Email,
		"permissions": permissions,
	})
}
