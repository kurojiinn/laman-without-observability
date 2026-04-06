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
}

// NewSMSRUProvider создает отправитель SMS.RU.
// testMode=true — добавляет test=1, SMS не списываются с баланса.
func NewSMSRUProvider(apiKey string, testMode bool) SMSProvider {
	resolvedKey := strings.TrimSpace(apiKey)
	if resolvedKey == "" || resolvedKey == "ТВОЙ_КЛЮЧ_ИЗ_SMS_RU" {
		fmt.Printf("[SMS.RU] API key не задан, используется NoopSMSProvider\n")
		return NewNoopSMSProvider()
	}

	return &SMSRUProvider{
		apiKey:   resolvedKey,
		testMode: testMode,
		client:   &http.Client{Timeout: 10 * time.Second},
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
		fmt.Printf("[SMS.RU] TEST MODE — SMS не отправляется. phone=%s code=%s\n", cleanedPhone, code)
	}

	requestURL := fmt.Sprintf("%s?%s", smsRUSendEndpoint, query.Encode())
	fmt.Printf("[SMS.RU] request: GET %s\n", requestURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return "", fmt.Errorf("не удалось создать запрос в SMS.RU: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		fmt.Printf("[SMS.RU] WARN: ошибка запроса, SMS не отправлено. phone=%s code=%s err=%v\n", cleanedPhone, code, err)
		return code, nil
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("[SMS.RU] response status=%d body=%s\n", resp.StatusCode, string(body))

	if resp.StatusCode == http.StatusTooManyRequests {
		fmt.Printf("[SMS.RU] WARN: rate limited, SMS не отправлено. phone=%s code=%s\n", cleanedPhone, code)
		return code, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		fmt.Printf("[SMS.RU] WARN: статус %d, SMS не отправлено. phone=%s code=%s\n", resp.StatusCode, cleanedPhone, code)
		return code, nil
	}

	var smsResp smsRUSendResponse
	if err := json.Unmarshal(body, &smsResp); err != nil {
		fmt.Printf("[SMS.RU] WARN: не удалось распарсить ответ, SMS статус неизвестен. phone=%s code=%s\n", cleanedPhone, code)
		return code, nil
	}

	if strings.EqualFold(strings.TrimSpace(smsResp.Status), "ERROR") {
		fmt.Printf("[SMS.RU] WARN: ошибка API (%s), SMS не отправлено. phone=%s code=%s\n", smsResp.StatusText, cleanedPhone, code)
		return code, nil
	}

	return code, nil
}


// NoopSMSProvider выводит код в stdout — для локальной разработки без API ключа.
type NoopSMSProvider struct{}

func NewNoopSMSProvider() SMSProvider { return &NoopSMSProvider{} }

func (n *NoopSMSProvider) RequestCode(_ context.Context, phone string) (string, error) {
	code := "0000"
	fmt.Printf("[NOOP SMS] phone=%s code=%s\n", phone, code)
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
