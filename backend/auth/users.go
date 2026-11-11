package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// @Summary		Get all users
// @Description	Get each user's ID, name, email, disabled status and permissions, ordered by email. Admin only, using the session cookie
// @Tags			Auth
// @Produce		json
// @Success		200	{array}	object{id=string,name=string,email=string,disabled=bool,permissions=[]string}	"User details"
// @Failure		401	"Not logged in"
// @Failure		403	"Not an administrator or user disabled"
// @Failure		500	"Error getting users"
// @Router			/users [get]
func GetUsers(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())

	var users []User
	if err := db.Order("email").Find(&users).Error; err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	response := make([]gin.H, 0, len(users))
	for _, user := range users {
		permissions, err := GetUserPermissions(db, user.ID)
		if err != nil {
			c.AbortWithError(http.StatusInternalServerError, err)
			return
		}

		response = append(response, gin.H{
			"id":          user.ID,
			"name":        user.Name,
			"email":       user.Email,
			"disabled":    user.Disabled,
			"permissions": permissions,
		})
	}

	c.JSON(http.StatusOK, response)
}
