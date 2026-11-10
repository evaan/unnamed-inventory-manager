package settings

type Setting struct {
	Name  string `gorm:"primaryKey"`
	Value string `gorm:"type:text;not null"`
}

type PatchSettingsRequest map[string]*string
