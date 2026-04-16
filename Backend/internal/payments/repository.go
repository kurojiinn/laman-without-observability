package payments

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PaymentRepository определяет интерфейс для доступа к данным оплат.
type PaymentRepository interface {
	// Create создаёт новую запись оплаты вне транзакции.
	Create(ctx context.Context, payment *models.Payment) error

	// CreateTx создаёт запись оплаты внутри транзакции.
	CreateTx(ctx context.Context, tx *sqlx.Tx, payment *models.Payment) error

	// GetByID возвращает оплату по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error)

	// GetByOrderID возвращает оплату по ID заказа.
	GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Payment, error)

	// UpdateStatus обновляет статус оплаты.
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.PaymentStatus) error
}
