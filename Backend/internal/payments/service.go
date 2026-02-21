package payments

import (
	"context"
	"fmt"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// PaymentService обрабатывает бизнес-логику, связанную с оплатами.
type PaymentService struct {
	paymentRepo PaymentRepository
}

// NewPaymentService создает новый сервис оплат.
func NewPaymentService(paymentRepo PaymentRepository) *PaymentService {
	return &PaymentService{
		paymentRepo: paymentRepo,
	}
}

// GetPayment получает оплату по ID.
func (s *PaymentService) GetPayment(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	payment, err := s.paymentRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить оплату: %w", err)
	}
	return payment, nil
}

// GetPaymentByOrderID получает оплату по ID заказа.
func (s *PaymentService) GetPaymentByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Payment, error) {
	payment, err := s.paymentRepo.GetByOrderID(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить оплату: %w", err)
	}
	return payment, nil
}

// UpdatePaymentStatusRequest представляет запрос на обновление статуса оплаты.
type UpdatePaymentStatusRequest struct {
	Status models.PaymentStatus `json:"status" binding:"required"`
}

// UpdatePaymentStatus обновляет статус оплаты.
func (s *PaymentService) UpdatePaymentStatus(ctx context.Context, id uuid.UUID, status models.PaymentStatus) error {
	if err := s.paymentRepo.UpdateStatus(ctx, id, status); err != nil {
		return fmt.Errorf("не удалось обновить статус оплаты: %w", err)
	}
	return nil
}
