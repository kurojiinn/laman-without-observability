package orders

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// OrderRepository определяет интерфейс для доступа к данным заказов.
type OrderRepository interface {
	// Create создаёт новый заказ вне транзакции.
	Create(ctx context.Context, order *models.Order) error

	// CreateTx создаёт заказ внутри переданной транзакции.
	// Используется в CreateOrder для атомарного создания заказа со всеми зависимостями.
	CreateTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error

	// GetByID возвращает заказ по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error)

	// GetByUserID возвращает все заказы пользователя.
	GetByUserID(ctx context.Context, userID uuid.UUID) ([]models.Order, error)

	// UpdateStatus обновляет статус заказа.
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.OrderStatus) error

	// Update обновляет поля заказа.
	Update(ctx context.Context, order *models.Order) error
}

// OrderItemRepository определяет интерфейс для доступа к данным позиций заказа.
type OrderItemRepository interface {
	// Create создаёт одну позицию заказа.
	Create(ctx context.Context, item *models.OrderItem) error

	// CreateBatchTx создаёт несколько позиций заказа внутри транзакции.
	// Используется совместно с OrderRepository.CreateTx.
	CreateBatchTx(ctx context.Context, tx *sqlx.Tx, items []models.OrderItem) error

	// GetByOrderID возвращает все позиции заказа.
	GetByOrderID(ctx context.Context, orderID uuid.UUID) ([]models.OrderItem, error)
}
