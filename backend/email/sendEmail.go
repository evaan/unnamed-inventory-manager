package email

import (
	"gopkg.in/gomail.v2"
)

func SendEmail(d *gomail.Dialer, from, to, subject, body, contentType string) {
	if contentType == "" {
		contentType = "text/html"
	}

	m := gomail.NewMessage()

	m.SetHeader("From", from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody(contentType, body)

	if err := d.DialAndSend(m); err != nil {
		panic(err)
	}
}
