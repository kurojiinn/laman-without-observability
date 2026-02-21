package delivery

import (
	"context"
	"fmt"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// DeliveryService обрабатывает бизнес-логику, связанную с доставками.
type DeliveryService struct {
	deliveryRepo DeliveryRepository
}

// NewDeliveryService создает новый сервис доставок.
func NewDeliveryService(deliveryRepo DeliveryRepository) *DeliveryService {
	return &DeliveryService{
		deliveryRepo: deliveryRepo,
	}
}

// GetDelivery получает информацию о доставке по ID заказа.
func (s *DeliveryService) GetDelivery(ctx context.Context, orderID uuid.UUID) (*models.Delivery, error) {
	delivery, err := s.deliveryRepo.GetByOrderID(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить доставку: %w", err)
	}
	return delivery, nil
}
