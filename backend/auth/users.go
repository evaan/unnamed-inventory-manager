package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
