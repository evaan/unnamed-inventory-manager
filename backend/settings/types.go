package settings

type Setting struct {
	Name  string `gorm:"primaryKey"`
	Value string `gorm:"type:text;not null"`
}

type PatchSettingsRequest map[string]*string

type CreateSettingRequest struct {
	Name  string  `json:"name"`
	Value *string `json:"value"`
}
