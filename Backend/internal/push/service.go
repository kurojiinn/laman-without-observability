package push

import (
	"context"
	"encoding/json"
	"fmt"

	webpush "github.com/SherClockHolmes/webpush-go"
	"database/sql"

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
	defer rows.Close()

	payload, _ := json.Marshal(n)

	for rows.Next() {
		var endpoint, p256dh, auth string
		if err := rows.Scan(&endpoint, &p256dh, &auth); err != nil {
			continue
		}
		go s.send(endpoint, p256dh, auth, payload)
	}
}

func (s *Service) send(endpoint, p256dh, auth string, payload []byte) {
	sub := &webpush.Subscription{
		Endpoint: endpoint,
		Keys: webpush.Keys{
			P256dh: p256dh,
			Auth:   auth,
		},
	}
	resp, err := webpush.SendNotification(payload, sub, &webpush.Options{
		VAPIDPublicKey:  s.vapidPub,
		VAPIDPrivateKey: s.vapidPriv,
		Subscriber:      fmt.Sprintf("mailto:%s", s.vapidEmail),
		TTL:             86400,
	})
	if err != nil {
		s.logger.Warn("push: send failed", zap.String("endpoint", endpoint), zap.Error(err))
		return
	}
	defer resp.Body.Close()
}

// VAPIDPublicKey возвращает публичный VAPID ключ для фронтенда.
func (s *Service) VAPIDPublicKey() string {
	return s.vapidPub
}
