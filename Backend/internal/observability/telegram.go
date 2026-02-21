package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"time"

	"Laman/internal/models"
)

// TelegramNotifier отправляет уведомления в Telegram.
type TelegramNotifier struct {
	botToken string
	chatID   string
	client   *http.Client
	apiBase  string
}

// OrderMessageMeta содержит данные для формирования сообщения.
type OrderMessageMeta struct {
	Customer string
	Phone    string
	Comment  string
	Address  string
	Items    string
}

type orderMessageMetaKey struct{}

// WithOrderMessageMeta добавляет метаданные заказа в context.
func WithOrderMessageMeta(ctx context.Context, meta OrderMessageMeta) context.Context {
	return context.WithValue(ctx, orderMessageMetaKey{}, meta)
}

func orderMessageMetaFromContext(ctx context.Context) (OrderMessageMeta, bool) {
	meta, ok := ctx.Value(orderMessageMetaKey{}).(OrderMessageMeta)
	return meta, ok
}

// NewTelegramNotifier создает TelegramNotifier с таймаутом 5 секунд.
func NewTelegramNotifier(botToken, chatID string) (*TelegramNotifier, error) {
	if botToken == "" || chatID == "" {
		return nil, errors.New("telegram bot token or chat id is empty")
	}

	return &TelegramNotifier{
		botToken: botToken,
		chatID:   chatID,
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
		apiBase: "https://api.telegram.org",
	}, nil
}

// NotifyNewOrder отправляет уведомление о новом заказе.
func (n *TelegramNotifier) NotifyNewOrder(ctx context.Context, order *models.Order) error {
	if n == nil {
		return nil
	}
	if order == nil {
		return errors.New("order is nil")
	}

	meta, _ := orderMessageMetaFromContext(ctx)
	message := buildOrderMessage(order, meta)

	payload := sendMessageRequest{
		ChatID:                n.chatID,
		Text:                  message,
		ParseMode:             "HTML",
		DisableWebPagePreview: true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/bot%s/sendMessage", n.apiBase, n.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram api returned %s: %s", resp.Status, string(respBody))
	}

	return nil
}

// NotifyOrderCancelled отправляет уведомление об отмене заказа.
func (n *TelegramNotifier) NotifyOrderCancelled(ctx context.Context, order *models.Order) error {
	if n == nil {
		return nil
	}
	if order == nil {
		return errors.New("order is nil")
	}

	meta, _ := orderMessageMetaFromContext(ctx)
	message := buildCancelledOrderMessage(order, meta)

	payload := sendMessageRequest{
		ChatID:                n.chatID,
		Text:                  message,
		ParseMode:             "HTML",
		DisableWebPagePreview: true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/bot%s/sendMessage", n.apiBase, n.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram api returned %s: %s", resp.Status, string(respBody))
	}

	return nil
}

type sendMessageRequest struct {
	ChatID                string `json:"chat_id"`
	Text                  string `json:"text"`
	ParseMode             string `json:"parse_mode,omitempty"`
	DisableWebPagePreview bool   `json:"disable_web_page_preview,omitempty"`
}

func buildOrderMessage(order *models.Order, meta OrderMessageMeta) string {
	shortID := shortOrderID(order.ID.String())
	customer := fallback(meta.Customer, "Гость")
	phone := fallback(meta.Phone, "—")
	comment := fallback(meta.Comment, "—")
	address := fallback(meta.Address, "—")
	items := fallback(meta.Items, "—")

	createdAt := order.CreatedAt.Local().Format("15:04")
	total := formatMoney(order.FinalTotal)

	return fmt.Sprintf(
		"<b>🆕 Новый заказ</b> <code>%s</code>\n"+
			"<b>👤 Клиент:</b> %s\n"+
			"<b>📞 Телефон:</b> %s\n"+
			"<b>📝 Комментарий:</b> %s\n"+
			"<b>📍 Адрес:</b> %s\n"+
			"<b>💰 Итого:</b> %s\n"+
			"<b>📦 Товары:</b> %s\n"+
			"<b>⏰ Время:</b> %s",
		html.EscapeString(shortID),
		html.EscapeString(customer),
		html.EscapeString(phone),
		html.EscapeString(comment),
		html.EscapeString(address),
		html.EscapeString(total),
		html.EscapeString(items),
		html.EscapeString(createdAt),
	)
}

func buildCancelledOrderMessage(order *models.Order, meta OrderMessageMeta) string {
	shortID := shortOrderID(order.ID.String())
	customer := fallback(meta.Customer, "Гость")
	phone := fallback(meta.Phone, "—")
	comment := fallback(meta.Comment, "—")
	address := fallback(meta.Address, "—")
	items := fallback(meta.Items, "—")

	createdAt := order.CreatedAt.Local().Format("15:04")
	total := formatMoney(order.FinalTotal)

	return fmt.Sprintf(
		"<b>❌ Заказ отменён</b> <code>%s</code>\n"+
			"<b>👤 Клиент:</b> %s\n"+
			"<b>📞 Телефон:</b> %s\n"+
			"<b>📝 Комментарий:</b> %s\n"+
			"<b>📍 Адрес:</b> %s\n"+
			"<b>💰 Итого:</b> %s\n"+
			"<b>📦 Товары:</b> %s\n"+
			"<b>⏰ Время:</b> %s",
		html.EscapeString(shortID),
		html.EscapeString(customer),
		html.EscapeString(phone),
		html.EscapeString(comment),
		html.EscapeString(address),
		html.EscapeString(total),
		html.EscapeString(items),
		html.EscapeString(createdAt),
	)
}

func shortOrderID(id string) string {
	if len(id) <= 8 {
		return id
	}
	return id[:8]
}

func fallback(value, def string) string {
	if value == "" {
		return def
	}
	return value
}

func formatMoney(amount float64) string {
	if amount == float64(int64(amount)) {
		return fmt.Sprintf("%.0f₽", amount)
	}
	return fmt.Sprintf("%.2f₽", amount)
}
