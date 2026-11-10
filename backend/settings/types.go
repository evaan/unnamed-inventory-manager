package settings

const SignupPolicy = "signup_policy"
const WhitelistedEmailDomains = "whitelisted_email_domains"

type Setting struct {
	Name  string `gorm:"primaryKey"`
	Value string `gorm:"type:text;not null"`
}

type PatchSettingsRequest map[string]*string
