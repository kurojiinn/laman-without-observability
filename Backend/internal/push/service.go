package push

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Subscription struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

type Notification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url,omitempty"`
}

type Service struct {
	db         *sql.DB
	logger     *zap.Logger
	vapidPub   string
	vapidPriv  string
	vapidEmail string
}

func NewService(db *sql.DB, logger *zap.Logger, vapidPub, vapidPriv, vapidEmail string) *Service {
	return &Service{
		db:         db,
		logger:     logger,
		vapidPub:   vapidPub,
		vapidPriv:  vapidPriv,
		vapidEmail: vapidEmail,
	}
}

func (s *Service) Subscribe(ctx context.Context, userID uuid.UUID, sub Subscription) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4
	`, userID, sub.Endpoint, sub.P256dh, sub.Auth)
	return err
}

func (s *Service) Unsubscribe(ctx context.Context, userID uuid.UUID, endpoint string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
		userID, endpoint,
	)
	return err
}

func (s *Service) SendToUser(ctx context.Context, userID uuid.UUID, n Notification) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		s.logger.Error("push: query subscriptions", zap.Error(err))
		return
	}
	defer func() { _ = rows.Close() }()

	payload, _ := json.Marshal(n)
	count := 0

	for rows.Next() {
		var endpoint, p256dh, auth string
		if err := rows.Scan(&endpoint, &p256dh, &auth); err != nil {
			continue
		}
		count++
		go s.send(endpoint, p256dh, auth, payload)
	}
	s.logger.Info("push: SendToUser",
		zap.String("user_id", userID.String()),
		zap.String("title", n.Title),
		zap.Int("subs", count))
}

func (s *Service) send(endpoint, p256dh, auth string, payload []byte) {
	sub := &webpush.Subscription{
		Endpoint: endpoint,
		Keys: webpush.Keys{
			P256dh: p256dh,
			Auth:   auth,
		},
	}
	subscriber := s.vapidEmail
	if !strings.HasPrefix(subscriber, "mailto:") && !strings.HasPrefix(subscriber, "https://") {
		subscriber = "mailto:" + subscriber
	}
	resp, err := webpush.SendNotification(payload, sub, &webpush.Options{
		VAPIDPublicKey:  s.vapidPub,
		VAPIDPrivateKey: s.vapidPriv,
		Subscriber:      subscriber,
		TTL:             86400,
	})
	if err != nil {
		s.logger.Warn("push: send failed", zap.String("endpoint", endpoint), zap.Error(err))
		return
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	s.logger.Info("push: send result",
		zap.Int("status", resp.StatusCode),
		zap.String("endpoint", endpoint),
		zap.String("body", string(body)),
		zap.String("subscriber", subscriber))
}

// VAPIDPublicKey возвращает публичный VAPID ключ для фронтенда.
func (s *Service) VAPIDPublicKey() string {
	return s.vapidPub
}

// NotificationForOrderStatus возвращает текст push-уведомления по статусу заказа.
// Принимает статус как строку, чтобы избежать импорта models в push-пакет.
func NotificationForOrderStatus(status string) (Notification, bool) {
	msgs := map[string][2]string{
		"ASSEMBLING":          {"Заказ собирается", "Сборщик начал формировать ваш заказ"},
		"ASSEMBLED":           {"Заказ собран", "Ваш заказ готов и ждёт курьера"},
		"NEEDS_CONFIRMATION":  {"Нужно уточнение", "Свяжитесь с нами — по вашему заказу есть вопрос"},
		"COURIER_PICKED_UP":   {"Курьер в пути", "Курьер забрал ваш заказ и едет к вам"},
		"DELIVERING":          {"Курьер едет к вам", "Совсем скоро ваш заказ будет у вас"},
		"DELIVERED":           {"Заказ доставлен", "Ваш заказ доставлен. Приятного!"},
		"CANCELLED":           {"Заказ отменён", "Ваш заказ был отменён"},
	}
	if m, ok := msgs[status]; ok {
		return Notification{Title: m[0], Body: m[1], URL: "/orders"}, true
	}
	return Notification{}, false
}
