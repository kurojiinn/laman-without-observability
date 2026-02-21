package models

import (
	"time"

	"github.com/google/uuid"
)

// PaymentMethod представляет способ оплаты.
type PaymentMethod string

const (
	PaymentMethodCash    PaymentMethod = "CASH"
	PaymentMethodTransfer PaymentMethod = "TRANSFER"
)

// PaymentStatus представляет статус оплаты.
type PaymentStatus string

const (
	PaymentStatusPending PaymentStatus = "pending"
	PaymentStatusPaid    PaymentStatus = "paid"
	PaymentStatusFailed  PaymentStatus = "failed"
)

// Payment представляет оплату заказа.
type Payment struct {
	ID            uuid.UUID     `db:"id" json:"id"`
	OrderID       uuid.UUID     `db:"order_id" json:"order_id"`
	Method        PaymentMethod `db:"method" json:"method"`
	Status        PaymentStatus `db:"status" json:"status"`
	Amount        float64       `db:"amount" json:"amount"`
	CreatedAt     time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time     `db:"updated_at" json:"updated_at"`
}
