package orders

import (
	"context"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// OrderRepository определяет интерфейс для доступа к данным заказов.
type OrderRepository interface {
	// Create создает новый заказ.
	Create(ctx context.Context, order *models.Order) error
	
	// GetByID получает заказ по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error)
	
	// GetByUserID получает все заказы пользователя.
	GetByUserID(ctx context.Context, userID uuid.UUID) ([]models.Order, error)
	
	// UpdateStatus обновляет статус заказа.
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.OrderStatus) error
	
	// Update обновляет заказ.
	Update(ctx context.Context, order *models.Order) error
}

// OrderItemRepository определяет интерфейс для доступа к данным товаров заказа.
type OrderItemRepository interface {
	// Create создает новый товар заказа.
	Create(ctx context.Context, item *models.OrderItem) error
	
	// CreateBatch создает несколько товаров заказа.
	CreateBatch(ctx context.Context, items []models.OrderItem) error
	
	// GetByOrderID получает все товары для заказа.
	GetByOrderID(ctx context.Context, orderID uuid.UUID) ([]models.OrderItem, error)
}
