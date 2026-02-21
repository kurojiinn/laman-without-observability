package payments

import (
	"context"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// PaymentRepository определяет интерфейс для доступа к данным оплат.
type PaymentRepository interface {
	// Create создает новую оплату.
	Create(ctx context.Context, payment *models.Payment) error
	
	// GetByID получает оплату по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error)
	
	// GetByOrderID получает оплату по ID заказа.
	GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Payment, error)
	
	// UpdateStatus обновляет статус оплаты.
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.PaymentStatus) error
}
