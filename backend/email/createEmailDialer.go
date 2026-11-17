package email

import (
	"gopkg.in/gomail.v2"
)

func CreateEmailDialer(host string, port int, username, password string) *gomail.Dialer {
	return gomail.NewDialer(host, port, username, password)
}
