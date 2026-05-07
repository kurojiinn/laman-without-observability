package auth

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net"
	"net/smtp"

	"go.uber.org/zap"
)

// EmailSender определяет контракт отправки OTP-кодов по email.
type EmailSender interface {
	SendOTP(ctx context.Context, to, code string) error
}

// SMTPEmailSender отправляет письма через SMTP с implicit TLS (порт 465).
type SMTPEmailSender struct {
	host     string
	port     string
	login    string
	password string
	from     string
	logger   *zap.Logger
}

// NewSMTPEmailSender создаёт отправитель писем.
// Если login или password пустые — возвращает NoopEmailSender.
func NewSMTPEmailSender(host, port, login, password, from string, logger *zap.Logger) EmailSender {
	if login == "" || password == "" {
		if logger != nil {
			logger.Warn("[SMTP] login или password не заданы, используется NoopEmailSender")
		}
		return &NoopEmailSender{logger: logger}
	}
	if from == "" {
		from = login
	}
	return &SMTPEmailSender{
		host:     host,
		port:     port,
		login:    login,
		password: password,
		from:     from,
		logger:   logger,
	}
}

func (s *SMTPEmailSender) SendOTP(_ context.Context, to, code string) error {
	tlsConfig := &tls.Config{ServerName: s.host}

	conn, err := tls.Dial("tcp", net.JoinHostPort(s.host, s.port), tlsConfig)
	if err != nil {
		return fmt.Errorf("не удалось подключиться к SMTP %s:%s: %w", s.host, s.port, err)
	}

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("ошибка SMTP клиента: %w", err)
	}
	defer func() { _ = client.Close() }()

	if err := client.Auth(smtp.PlainAuth("", s.login, s.password, s.host)); err != nil {
		return fmt.Errorf("ошибка аутентификации SMTP: %w", err)
	}
	if err := client.Mail(s.from); err != nil {
		return fmt.Errorf("SMTP MAIL FROM: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("SMTP RCPT TO: %w", err)
	}

	wc, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA: %w", err)
	}
	defer func() { _ = wc.Close() }()

	subject := base64.StdEncoding.EncodeToString([]byte("Код подтверждения Laman"))
	body := fmt.Sprintf(
		"Ваш код подтверждения: %s\r\nКод действителен 5 минут.\r\n\r\nЕсли вы не запрашивали код — проигнорируйте это письмо.",
		code,
	)
	msg := fmt.Sprintf(
		"From: Laman <%s>\r\nTo: %s\r\nSubject: =?UTF-8?B?%s?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		s.from, to, subject, body,
	)

	if _, err := fmt.Fprint(wc, msg); err != nil {
		return fmt.Errorf("ошибка записи тела письма: %w", err)
	}

	if s.logger != nil {
		s.logger.Info("[SMTP] письмо отправлено", zap.String("to", maskEmail(to)))
	}
	return nil
}

// NoopEmailSender выводит OTP в логи — для разработки без SMTP.
type NoopEmailSender struct {
	logger *zap.Logger
}

func (n *NoopEmailSender) SendOTP(_ context.Context, to, code string) error {
	if n.logger != nil {
		n.logger.Info("[EMAIL NOOP] тестовый OTP",
			zap.String("email", maskEmail(to)),
			zap.String("dev_otp", code),
		)
	}
	return nil
}

func maskEmail(email string) string {
	for i, c := range email {
		if c == '@' {
			if i <= 2 {
				return "***" + email[i:]
			}
			return email[:2] + "***" + email[i:]
		}
	}
	return "***"
}
