package models

import (
	"time"

	"github.com/google/uuid"
)

// OrderStatus представляет статус заказа.
type OrderStatus string

const (
	OrderStatusNew               OrderStatus = "NEW"
	OrderStatusNeedsConfirmation OrderStatus = "NEEDS_CONFIRMATION"
	OrderStatusConfirmed         OrderStatus = "CONFIRMED"
	OrderStatusInProgress        OrderStatus = "IN_PROGRESS"
	OrderStatusDelivered         OrderStatus = "DELIVERED"
	OrderStatusCancelled         OrderStatus = "CANCELLED"
)

// Order представляет заказ в системе.
// Поддерживает как зарегистрированных пользователей, так и гостевые заказы.
type Order struct {
	ID            uuid.UUID     `db:"id" json:"id"`
	UserID        *uuid.UUID    `db:"user_id" json:"user_id,omitempty"`
	GuestName     *string       `db:"guest_name" json:"guest_name,omitempty"`
	GuestPhone    *string       `db:"guest_phone" json:"guest_phone,omitempty"`
	GuestAddress  *string       `db:"guest_address" json:"guest_address,omitempty"`
	Comment       *string       `db:"comment" json:"comment,omitempty"`
	Status        OrderStatus   `db:"status" json:"status"`
	StoreID       uuid.UUID     `db:"store_id" json:"store_id"`
	PaymentMethod PaymentMethod `db:"payment_method" json:"payment_method"`
	ItemsTotal    float64       `db:"items_total" json:"items_total"`
	ServiceFee    float64       `db:"service_fee" json:"service_fee"`
	DeliveryFee   float64       `db:"delivery_fee" json:"delivery_fee"`
	FinalTotal    float64       `db:"final_total" json:"final_total"`
	CreatedAt     time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time     `db:"updated_at" json:"updated_at"`
}

// OrderItem представляет товар в заказе.
type OrderItem struct {
	ID        uuid.UUID `db:"id" json:"id"`
	OrderID   uuid.UUID `db:"order_id" json:"order_id"`
	ProductID uuid.UUID `db:"product_id" json:"product_id"`
	Quantity  int       `db:"quantity" json:"quantity"`
	Price     float64   `db:"price" json:"price"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// OrderWithItems представляет заказ с его товарами.
type OrderWithItems struct {
	Order
	Items []OrderItem `json:"items"`
}
