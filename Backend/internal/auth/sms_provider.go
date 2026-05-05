package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"

	"go.uber.org/zap"
)

const smsRUSendEndpoint = "https://sms.ru/sms/send"

var ErrSMSRateLimited = errors.New("sms rate limited")

// SMSProvider определяет контракт отправки одноразовых кодов.
type SMSProvider interface {
	// RequestCode генерирует код и отправляет его через SMS. Возвращает сам код.
	RequestCode(ctx context.Context, phone string) (string, error)
}

// SMSRUProvider реализует отправку SMS через API SMS.RU (/sms/send).
type SMSRUProvider struct {
	apiKey   string
	testMode bool
	client   *http.Client
	logger   *zap.Logger
}

// NewSMSRUProvider создает отправитель SMS.RU.
// testMode=true — добавляет test=1, SMS не списываются с баланса.
func NewSMSRUProvider(apiKey string, testMode bool, logger *zap.Logger) SMSProvider {
	resolvedKey := strings.TrimSpace(apiKey)
	if resolvedKey == "" || resolvedKey == "ТВОЙ_КЛЮЧ_ИЗ_SMS_RU" {
		if logger != nil {
			logger.Warn("[SMS.RU] API key не задан, используется NoopSMSProvider")
		}
		return NewNoopSMSProvider(logger)
	}

	return &SMSRUProvider{
		apiKey:   resolvedKey,
		testMode: testMode,
		client:   &http.Client{Timeout: 10 * time.Second},
		logger:   logger,
	}
}

// RequestCode генерирует 4-значный код и отправляет его через SMS.RU /sms/send.
func (s *SMSRUProvider) RequestCode(ctx context.Context, phone string) (string, error) {
	cleanedPhone := sanitizePhone(phone)
	if cleanedPhone == "" {
		return "", fmt.Errorf("номер телефона пустой после очистки")
	}

	code, err := generateCode(4)
	if err != nil {
		return "", fmt.Errorf("не удалось сгенерировать код: %w", err)
	}

	msg := fmt.Sprintf("Laman: ваш код подтверждения %s", code)

	query := url.Values{}
	query.Set("api_id", s.apiKey)
	query.Set("to", cleanedPhone)
	query.Set("msg", msg)
	query.Set("json", "1")
	if s.testMode {
		query.Set("test", "1")
		// DEV: код виден в логах для тестирования без реального SMS
		if s.logger != nil {
			s.logger.Info("[SMS.RU] TEST MODE — SMS не отправляется",
				zap.String("phone", maskPhone(cleanedPhone)),
				zap.String("code", code),
			)
		}
	}

	requestURL := fmt.Sprintf("%s?%s", smsRUSendEndpoint, query.Encode())
	// Логируем URL без api_id — ключ не должен попадать в логи
	if s.logger != nil {
		s.logger.Debug("[SMS.RU] отправка запроса",
			zap.String("phone", maskPhone(cleanedPhone)),
		)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return "", fmt.Errorf("не удалось создать запрос в SMS.RU: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		if s.logger != nil {
			s.logger.Warn("[SMS.RU] ошибка запроса, SMS не отправлено",
				zap.Error(err),
				zap.String("phone", maskPhone(cleanedPhone)),
			)
		}
		return code, nil
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	if s.logger != nil {
		s.logger.Debug("[SMS.RU] ответ", zap.Int("status", resp.StatusCode))
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		if s.logger != nil {
			s.logger.Warn("[SMS.RU] rate limited", zap.String("phone", maskPhone(cleanedPhone)))
		}
		return code, ErrSMSRateLimited
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if s.logger != nil {
			s.logger.Warn("[SMS.RU] неожиданный статус",
				zap.Int("status", resp.StatusCode),
				zap.String("phone", maskPhone(cleanedPhone)),
			)
		}
		return code, nil
	}

	var smsResp smsRUSendResponse
	if err := json.Unmarshal(body, &smsResp); err != nil {
		if s.logger != nil {
			s.logger.Warn("[SMS.RU] не удалось распарсить ответ",
				zap.String("phone", maskPhone(cleanedPhone)),
			)
		}
		return code, nil
	}

	if strings.EqualFold(strings.TrimSpace(smsResp.Status), "ERROR") {
		if s.logger != nil {
			s.logger.Warn("[SMS.RU] ошибка API",
				zap.String("status_text", smsResp.StatusText),
				zap.String("phone", maskPhone(cleanedPhone)),
			)
		}
		return code, nil
	}

	return code, nil
}

// NoopSMSProvider выводит код в логи — для локальной разработки без API ключа.
type NoopSMSProvider struct {
	logger *zap.Logger
}

func NewNoopSMSProvider(logger *zap.Logger) SMSProvider { return &NoopSMSProvider{logger: logger} }

func (n *NoopSMSProvider) RequestCode(_ context.Context, phone string) (string, error) {
	code := "0000"
	if n.logger != nil {
		n.logger.Info("[NOOP SMS] тестовый код",
			zap.String("phone", maskPhone(phone)),
			zap.String("code", code),
		)
	}
	return code, nil
}

// sanitizePhone удаляет все символы, кроме цифр.
func sanitizePhone(phone string) string {
	var out strings.Builder
	out.Grow(len(phone))
	for _, r := range phone {
		if unicode.IsDigit(r) {
			out.WriteRune(r)
		}
	}
	return out.String()
}

// smsRUSendResponse — JSON-ответ SMS.RU для /sms/send.
type smsRUSendResponse struct {
	Status     string `json:"status"`
	StatusCode int    `json:"status_code"`
	StatusText string `json:"status_text"`
}
