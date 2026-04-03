package picker

import (
	"Laman/internal/models"
	"context"

	"github.com/google/uuid"
)

type PickerRepository interface {
	GetOrderByID(ctx context.Context, orderID uuid.UUID) (*models.Order, error)
	GetOrders(ctx context.Context, storeID uuid.UUID) ([]models.Order, error)
	UpdateStatus(ctx context.Context, orderID uuid.UUID, status models.OrderStatus) error
	UpdateStatusAndAssignPicker(ctx context.Context, orderID uuid.UUID, status models.OrderStatus, pickerID uuid.UUID) error
	AssignPicker(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID) error
}
