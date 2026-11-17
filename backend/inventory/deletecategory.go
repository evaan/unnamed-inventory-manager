package inventory

import (
	"errors"
	"net/http"
	"uuid"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// @Summary		Delete an item category
// @Description	Removes the category from all items and makes its direct children top-level categories. Requires DeleteTag or Administrator.
// @Tags			Category
// @Param			id		path	string	true	"Item Category ID"	Format(uuid)
// @Success		204		"Category deleted"
// @Failure		400		"Invalid category ID"
// @Failure		401		"Not logged in"
// @Failure		403		"Permission denied or invalid frontend Origin or Referer"
// @Failure		404		"Category not found"
// @Failure		500		"Error deleting category"
// @Router			/categories/{id} [delete]
func DeleteCategory(c *gin.Context, db *gorm.DB) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	err = db.WithContext(c.Request.Context()).Transaction(func(tx *gorm.DB) error {
		var category ItemCategory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&category, "id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Exec("DELETE FROM item_category_links WHERE item_category_id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Model(&ItemCategory{}).Where("parent_id = ?", id).Update("parent_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&category).Error
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}

	c.Status(http.StatusNoContent)
}
