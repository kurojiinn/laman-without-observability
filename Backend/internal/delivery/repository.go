package delivery

import (
	"context"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// DeliveryRepository определяет интерфейс для доступа к данным доставок.
type DeliveryRepository interface {
	// Create создает новую запись доставки.
	Create(ctx context.Context, delivery *models.Delivery) error
	
	// GetByOrderID получает доставку по ID заказа.
	GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Delivery, error)
	
	// Update обновляет запись доставки.
	Update(ctx context.Context, delivery *models.Delivery) error
}
