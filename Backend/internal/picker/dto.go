package picker

import (
	"Laman/internal/models"

	"github.com/google/uuid"
)

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token   string     `json:"token"`
	UserID  uuid.UUID  `json:"user_id"`
	StoreID *uuid.UUID `json:"store_id"`
	Role    string     `json:"role"`
}

type UpdateOrderStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// PickerOrderItem представляет товар в заказе с названием продукта.
type PickerOrderItem struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	ProductID   *uuid.UUID `db:"product_id" json:"product_id"`
	ProductName string     `db:"product_name" json:"product_name"`
	ImageURL    *string    `db:"image_url" json:"image_url"`
	Quantity    int        `db:"quantity" json:"quantity"`
	Price       float64    `db:"price" json:"price"`
}

// PickerOrderResponse представляет заказ с товарами для панели сборщика.
type PickerOrderResponse struct {
	models.Order
	Items []PickerOrderItem `json:"items"`
}

// AddItemRequest — запрос на добавление товара сборщиком (ручной ввод замены).
type AddItemRequest struct {
	ProductName string  `json:"product_name" binding:"required"`
	Price       float64 `json:"price" binding:"required,gt=0"`
	Quantity    int     `json:"quantity" binding:"required,gt=0"`
}
