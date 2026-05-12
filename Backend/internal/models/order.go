package models

import (
	"time"

	"github.com/google/uuid"
)

// OutOfStockAction — что делать сборщику, если товара нет в наличии.
type OutOfStockAction string

const (
	OutOfStockRemove  OutOfStockAction = "REMOVE"  // убрать товар из заказа
	OutOfStockReplace OutOfStockAction = "REPLACE" // заменить на аналог
	OutOfStockCall    OutOfStockAction = "CALL"    // позвонить клиенту
)

// OrderStatus представляет статус заказа.
type OrderStatus string

const (
	OrderStatusNew               = "NEW"                // создан, ждёт сборщика
	OrderStatusAcceptedByPicker  = "ACCEPTED_BY_PICKER" // сборщик взял в работу
	OrderStatusAssembling        = "ASSEMBLING"         // собирается
	OrderStatusAssembled         = "ASSEMBLED"          // собран, ждём курьера
	OrderStatusWaitingCourier    = "WAITING_COURIER"    // курьер вызван
	OrderStatusCourierPickedUp   = "COURIER_PICKED_UP"  // курьер забрал
	OrderStatusDelivering        = "DELIVERING"         // в пути
	OrderStatusDelivered         = "DELIVERED"          // доставлен
	OrderStatusCancelled         = "CANCELLED"          // отменён
	OrderStatusNeedsConfirmation = "NEEDS_CONFIRMATION" // нужно уточнение у клиента
)

// Order представляет заказ в системе.
type Order struct {
	ID              uuid.UUID     `db:"id" json:"id"`
	UserID          *uuid.UUID    `db:"user_id" json:"user_id,omitempty"`
	CourierID       *uuid.UUID    `db:"courier_id" json:"courier_id,omitempty"`
	GuestName       *string       `db:"guest_name" json:"guest_name,omitempty"`
	CustomerPhone   *string       `db:"customer_phone" json:"customer_phone,omitempty"`
	DeliveryAddress *string       `db:"delivery_address" json:"delivery_address,omitempty"`
	Comment         *string       `db:"comment" json:"comment,omitempty"`
	Status        OrderStatus   `db:"status" json:"status"`
	StoreID       uuid.UUID     `db:"store_id" json:"store_id"`
	PaymentMethod PaymentMethod `db:"payment_method" json:"payment_method"`
	ItemsTotal    float64       `db:"items_total" json:"items_total"`
	ServiceFee    float64       `db:"service_fee" json:"service_fee"`
	DeliveryFee   float64       `db:"delivery_fee" json:"delivery_fee"`
	FinalTotal    float64       `db:"final_total" json:"final_total"`
	CreatedAt     time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time     `db:"updated_at" json:"updated_at"`
	PickerID           *uuid.UUID       `db:"picker_id" json:"picker_id,omitempty"`
	OutOfStockAction   *OutOfStockAction `db:"out_of_stock_action" json:"out_of_stock_action,omitempty"`
	DeliveryType       string            `db:"delivery_type" json:"delivery_type"`
	ScheduledAt        *time.Time        `db:"scheduled_at" json:"scheduled_at"`
	DeliverySurcharge  int               `db:"delivery_surcharge" json:"delivery_surcharge"`
}

// DeliveryType — тип доставки заказа.
const (
	DeliveryTypeNow       = "now"       // привезти сейчас, стандартная доставка
	DeliveryTypeScheduled = "scheduled" // доставка к указанному времени
	DeliveryTypeExpress   = "express"   // срочная доставка с доплатой
)

// OrderItem представляет товар в заказе.
// Options содержит snapshot выбранных клиентом опций (порция, острота и т.п.)
// — сохраняются в order_item_options, чтобы изменения в карточке товара не ломали историю.
type OrderItem struct {
	ID        uuid.UUID         `db:"id" json:"id"`
	OrderID   uuid.UUID         `db:"order_id" json:"order_id"`
	ProductID *uuid.UUID        `db:"product_id" json:"product_id,omitempty"`
	Name      string            `db:"product_name" json:"name"`
	Quantity  int               `db:"quantity" json:"quantity"`
	Price     float64           `db:"price" json:"price"`
	CreatedAt time.Time         `db:"created_at" json:"created_at"`
	Options   []OrderItemOption `json:"options,omitempty"`
}

// OrderItemOption — snapshot выбранной клиентом опции.
type OrderItemOption struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	OrderItemID uuid.UUID  `db:"order_item_id" json:"order_item_id"`
	GroupID     *uuid.UUID `db:"group_id" json:"group_id,omitempty"`
	ValueID     *uuid.UUID `db:"value_id" json:"value_id,omitempty"`
	GroupName   string     `db:"group_name" json:"group_name"`
	ValueName   string     `db:"value_name" json:"value_name"`
	PriceDelta  *float64   `db:"price_delta" json:"price_delta,omitempty"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
}

// OrderWithItems представляет заказ с его товарами.
type OrderWithItems struct {
	Order
	Items []OrderItem `json:"items"`
}

func IsValidStateTransition(current, next OrderStatus) bool {
	validTransitions := map[OrderStatus][]OrderStatus{
		OrderStatusNew: {
			OrderStatusAcceptedByPicker,
			OrderStatusCancelled,
		},
		OrderStatusAcceptedByPicker: {
			OrderStatusAssembling,
			OrderStatusNeedsConfirmation,
			OrderStatusCancelled,
		},
		OrderStatusNeedsConfirmation: {
			OrderStatusAssembling,
			OrderStatusCancelled,
		},
		OrderStatusAssembling: {
			OrderStatusAssembled,
			OrderStatusCancelled,
		},
		OrderStatusAssembled: {
			OrderStatusWaitingCourier,
			OrderStatusCancelled,
		},
		OrderStatusWaitingCourier: {
			OrderStatusCourierPickedUp,
		},
		OrderStatusCourierPickedUp: {
			OrderStatusDelivering,
		},
		OrderStatusDelivering: {
			OrderStatusDelivered,
		},
		OrderStatusDelivered: {}, // Финальное состояние
		OrderStatusCancelled: {}, // Финальное состояние
	}

	allowed, ok := validTransitions[current]
	if !ok {
		return false
	}

	for _, status := range allowed {
		if status == next {
			return true
		}
	}

	return false
}
