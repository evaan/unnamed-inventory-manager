package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get the current user
// @Description	Returns your name, email and permissions, or just loggedIn: false if you're not logged in
// @Tags			Auth
// @Produce		json
// @Success		200	{object}	object{loggedIn=bool,name=string,email=string,permissions=[]string}	"Login status and user details"
// @Failure		500	"Error getting current user"
// @Router			/whoami [get]
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
