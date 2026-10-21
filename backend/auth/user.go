package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
