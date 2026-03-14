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

const smsRUCallEndpoint = "https://sms.ru/code/call"

var ErrSMSRateLimited = errors.New("sms rate limited")

// SMSProvider определяет контракт отправки одноразовых кодов.
type SMSProvider interface {
	// RequestCode запрашивает код подтверждения через звонок и возвращает код из ответа провайдера.
	RequestCode(ctx context.Context, phone string) (string, error)
}

// SMSRUProvider реализует отправку SMS через API SMS.RU.
type SMSRUProvider struct {
	apiKey string
	client *http.Client
}

// NewSMSRUProvider создает отправитель SMS.RU на стандартном http.Client.
func NewSMSRUProvider(apiKey string) SMSProvider {
	resolvedKey := strings.TrimSpace(apiKey)
	if resolvedKey == "" || resolvedKey == "ТВОЙ_КЛЮЧ_ИЗ_SMS_RU" {
		fmt.Printf("[SMS.RU] API key is not configured, using NoopSMSProvider\n")
		return NewNoopSMSProvider()
	}

	return &SMSRUProvider{
		apiKey: resolvedKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// RequestCode запрашивает звонок-подтверждение и возвращает код из ответа SMS.RU.
func (s *SMSRUProvider) RequestCode(ctx context.Context, phone string) (string, error) {
	cleanedPhone := sanitizePhone(phone)
	if cleanedPhone == "" {
		return "", fmt.Errorf("номер телефона пустой после очистки")
	}

	query := url.Values{}
	query.Set("api_id", s.apiKey)
	query.Set("phone", cleanedPhone)
	query.Set("json", "1")

	requestURL := fmt.Sprintf("%s?%s", smsRUCallEndpoint, query.Encode())
	fmt.Println("Тестовый запрос звонка на свой номер...")
	fmt.Printf("[SMS.RU] request: GET %s\n", requestURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return "", fmt.Errorf("не удалось создать запрос в SMS.RU: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ошибка запроса в SMS.RU: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("[SMS.RU] response status=%d body=%s\n", resp.StatusCode, string(body))
	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrSMSRateLimited
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("SMS.RU вернул статус %d: %s", resp.StatusCode, string(body))
	}

	var smsResp smsRUCallResponse
	if err := json.Unmarshal(body, &smsResp); err != nil {
		return "", fmt.Errorf("не удалось распарсить ответ SMS.RU: %w", err)
	}
	if strings.EqualFold(strings.TrimSpace(smsResp.Status), "ERROR") {
		statusText := strings.ToLower(strings.TrimSpace(smsResp.StatusText))
		if strings.Contains(statusText, "часто") || strings.Contains(statusText, "often") {
			return "", ErrSMSRateLimited
		}
		return "", fmt.Errorf("SMS.RU ошибка: %s", strings.TrimSpace(smsResp.StatusText))
	}
	code := strings.TrimSpace(smsResp.Code.String())
	if code == "" {
		return "", fmt.Errorf("SMS.RU не вернул код подтверждения: %s", string(body))
	}
	return code, nil
}

// NoopSMSProvider логирует отправку кода в stdout для локальной разработки.
type NoopSMSProvider struct{}

// NewNoopSMSProvider создает заглушку отправителя SMS.
func NewNoopSMSProvider() SMSProvider {
	return &NoopSMSProvider{}
}

// RequestCode выводит тестовый код в лог вместо вызова внешнего сервиса.
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

// smsRUCallResponse представляет JSON-ответ SMS.RU для метода /code/call.
type smsRUCallResponse struct {
	Status     string      `json:"status"`
	StatusCode int         `json:"status_code"`
	Code       json.Number `json:"code"`
	StatusText string      `json:"status_text"`
}
