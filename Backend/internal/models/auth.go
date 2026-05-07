package models

import (
	"time"

	"github.com/google/uuid"
)

// AuthCode представляет OTP-код верификации (phone или email).
type AuthCode struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Phone     string    `db:"phone" json:"phone"`
	Email     *string   `db:"email" json:"email,omitempty"`
	Code      string    `db:"code" json:"code"`
	ExpiresAt time.Time `db:"expires_at" json:"expires_at"`
	Used      bool      `db:"used" json:"used"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
