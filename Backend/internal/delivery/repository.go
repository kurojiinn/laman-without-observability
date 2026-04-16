package delivery

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// DeliveryRepository определяет интерфейс для доступа к данным доставок.
type DeliveryRepository interface {
	// Create создаёт новую запись доставки вне транзакции.
	Create(ctx context.Context, delivery *models.Delivery) error

	// CreateTx создаёт запись доставки внутри транзакции.
	CreateTx(ctx context.Context, tx *sqlx.Tx, delivery *models.Delivery) error

	// GetByOrderID возвращает доставку по ID заказа.
	GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Delivery, error)

	// Update обновляет запись доставки.
	Update(ctx context.Context, delivery *models.Delivery) error
}
