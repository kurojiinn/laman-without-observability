package models

import (
	"time"

	"github.com/google/uuid"
)

// Delivery представляет информацию о доставке заказа.
type Delivery struct {
	ID        uuid.UUID  `db:"id" json:"id"`
	OrderID   uuid.UUID  `db:"order_id" json:"order_id"`
	Address   string     `db:"address" json:"address"`
	Distance  *float64   `db:"distance" json:"distance,omitempty"`
	Weight    *float64   `db:"weight" json:"weight,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt time.Time  `db:"updated_at" json:"updated_at"`
}
