package auth

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

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

	if _, err := fmt.Fprint(wc, buildOTPMessage(s.from, to, code)); err != nil {
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

// buildOTPMessage собирает multipart/alternative письмо с text и HTML частями.
// HTML-версия + Date + Message-ID + понятный From снижают вероятность попадания в спам.
func buildOTPMessage(from, to, code string) string {
	subject := base64.StdEncoding.EncodeToString([]byte("Код подтверждения Yuher: " + code))
	date := time.Now().Format(time.RFC1123Z)
	messageID := generateMessageID(from)
	boundary := generateBoundary()

	textBody := fmt.Sprintf(
		"Здравствуйте!\r\n\r\n"+
			"Ваш код подтверждения для входа в Yuher: %s\r\n\r\n"+
			"Код действителен 5 минут.\r\n\r\n"+
			"Если вы не запрашивали код — просто проигнорируйте это письмо, никаких действий с вашей стороны не требуется.\r\n\r\n"+
			"---\r\n"+
			"Yuher — доставка чего угодно по Грозному\r\n"+
			"Это автоматическое письмо, отвечать на него не нужно.",
		code,
	)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>Код подтверждения Yuher</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%%" style="background:#f4f4f7;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <tr><td style="background:linear-gradient(135deg,#312e81 0%%,#4338ca 100%%);padding:32px 32px 24px;text-align:center;">
          <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Yuher</div>
          <div style="color:#c7d2fe;font-size:13px;margin-top:6px;">Доставка по Грозному</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#111827;font-weight:600;">Код подтверждения</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.5;">Используйте этот код для входа или регистрации в приложении:</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;font-weight:700;color:#4338ca;letter-spacing:8px;font-family:'SF Mono',Menlo,Consolas,monospace;">%s</div>
          </div>
          <p style="margin:0 0 8px;color:#6b7280;font-size:14px;line-height:1.5;">Код действителен <strong>5 минут</strong>.</p>
          <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">Если вы не запрашивали этот код — просто проигнорируйте письмо.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">Это автоматическое письмо, отвечать на него не нужно.<br>© %d Yuher. Все права защищены.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`, code, time.Now().Year())

	var b strings.Builder
	fmt.Fprintf(&b, "From: Yuher <%s>\r\n", from)
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: =?UTF-8?B?%s?=\r\n", subject)
	fmt.Fprintf(&b, "Date: %s\r\n", date)
	fmt.Fprintf(&b, "Message-ID: %s\r\n", messageID)
	b.WriteString("MIME-Version: 1.0\r\n")
	fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=\"%s\"\r\n\r\n", boundary)

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(textBody)
	b.WriteString("\r\n\r\n")

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n\r\n")
	b.WriteString(htmlBody)
	b.WriteString("\r\n\r\n")

	fmt.Fprintf(&b, "--%s--\r\n", boundary)

	return b.String()
}

func generateBoundary() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return "yuhher_" + hex.EncodeToString(buf)
}

func generateMessageID(from string) string {
	domain := "yuhher.ru"
	if at := strings.LastIndex(from, "@"); at >= 0 && at+1 < len(from) {
		domain = from[at+1:]
	}
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), hex.EncodeToString(buf), domain)
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
