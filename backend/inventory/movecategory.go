package inventory

import (
	"encoding/json"
	"errors"
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type MoveCategoryReq struct {
	ParentID json.RawMessage `json:"parentID" binding:"required" swaggertype:"string" format:"uuid" extensions:"x-nullable"`
}

var errCategoryCycle = errors.New("category parent would create a cycle")

// @Summary		Move an item category
// @Description	Set the parent of a category, or send null to make it a top-level category. Requires CreateTag or Administrator.
// @Tags			Category
// @Accept			json
// @Param			id		path	string			true	"Item Category ID"	Format(uuid)
// @Param			body	body	MoveCategoryReq	true	"New parent category ID or null"
// @Success		204		"Category moved"
// @Failure		400		"Invalid ID, invalid request body or circular category hierarchy"
// @Failure		401		"Not logged in"
// @Failure		403		"Permission denied or invalid frontend Origin or Referer"
// @Failure		404		"Category or parent category not found"
// @Failure		500		"Error moving category"
// @Router			/categories/{id} [patch]
func MoveCategory(c *gin.Context, db *gorm.DB) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	var req MoveCategoryReq
	var parentID *uuid.UUID
	if c.ShouldBindJSON(&req) != nil || json.Unmarshal(req.ParentID, &parentID) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "parentID must be a category ID or null"})
		return
	}

	err = db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		// Concurrent moves must validate the hierarchy in the same lock order.
		var categories []ItemCategory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Order("id").Find(&categories).Error; err != nil {
			return err
		}
		parents := make(map[uuid.UUID]*uuid.UUID, len(categories))
		for _, category := range categories {
			parents[category.ID] = category.ParentID
		}
		if _, exists := parents[id]; !exists {
			return gorm.ErrRecordNotFound
		}

		visited := map[uuid.UUID]bool{id: true}
		for ancestor := parentID; ancestor != nil; {
			if visited[*ancestor] {
				return errCategoryCycle
			}
			visited[*ancestor] = true
			parent, exists := parents[*ancestor]
			if !exists {
				return gorm.ErrRecordNotFound
			}
			ancestor = parent
		}
		return tx.Model(&ItemCategory{}).Where("id = ?", id).Update("parent_id", parentID).Error
	})

	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "Category or parent category not found"})
	case errors.Is(err, errCategoryCycle):
		c.JSON(http.StatusBadRequest, gin.H{"error": "A category cannot be moved under itself or its subcategories"})
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to move category"})
	default:
		c.Status(http.StatusNoContent)
	}
}
