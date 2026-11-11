package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// @Summary		Get a user
// @Description	Get a user's ID, name, email, disabled status and permissions. Admin only, using the session cookie
// @Tags			Auth
// @Produce		json
// @Param			id	path	string	true	"User ID"	Format(uuid)
// @Success		200	{object}	object{id=string,name=string,email=string,disabled=bool,permissions=[]string}	"User details"
// @Failure		400	"Invalid user ID"
// @Failure		401	"Not logged in"
// @Failure		403	"Not an administrator or user disabled"
// @Failure		404	"User not found"
// @Failure		500	"Error getting user"
// @Router			/user/{id} [get]
func GetUserByID(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var user User
	err = db.First(&user, "id = ?", userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	permissions, err := GetUserPermissions(db, user.ID)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          user.ID,
		"name":        user.Name,
		"email":       user.Email,
		"disabled":    user.Disabled,
		"permissions": permissions,
	})
}

// @Summary		Update a user
// @Description	Disable or enable a user. Admin only, using the session cookie
// @Tags			Auth
// @Accept			json
// @Param			id		path	string				true	"User ID"	Format(uuid)
// @Param			body	body	PatchUserRequest	true	"Whether the user is disabled"
// @Param			Origin	header	string				false	"Frontend origin, required if Referer is not set"
// @Success		204		"User updated"
// @Failure		400		"Invalid user ID or request body"
// @Failure		401		"Not logged in"
// @Failure		403		"Not an administrator or invalid frontend Origin or Referer"
// @Failure		404		"User not found"
// @Failure		500		"Error updating user"
// @Router			/users/{id} [patch]
func PatchUser(c *gin.Context, db *gorm.DB) {
	db = db.WithContext(c.Request.Context())

	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	exists, err := DoesUserExist(db, userID.String())
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}
	if !exists {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	var req PatchUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		return tx.Model(&User{}).
			Where("id = ?", userID).
			Update("disabled", *req.Disabled).Error
	})
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.Status(http.StatusNoContent)
}
