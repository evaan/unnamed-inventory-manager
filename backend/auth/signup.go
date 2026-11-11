package auth

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/evaandev/unnamed-inventory-manager/settings"
	"gorm.io/gorm"
)

func newUserDisabled(db *gorm.DB, email string) (bool, error) {
	policy, err := settings.Get(db, "signup_policy")
	if err != nil {
		return true, err
	}

	switch policy {
	case "open":
		return false, nil
	case "closed":
		return true, nil
	case "whitelist":
		value, err := settings.Get(db, "whitelisted_email_domains")
		if err != nil {
			return true, err
		}

		var domains []string
		if err := json.Unmarshal([]byte(value), &domains); err != nil {
			return true, err
		}
		if domains == nil {
			return true, errors.New("whitelisted email domains must be an array")
		}

		parts := strings.Split(email, "@")
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			return true, errors.New("invalid email address")
		}
		for _, domain := range domains {
			if strings.EqualFold(parts[1], strings.TrimSpace(domain)) {
				return false, nil
			}
		}

		return true, nil
	default:
		return true, errors.New("invalid signup policy")
	}
}
