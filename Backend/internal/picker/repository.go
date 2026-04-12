package picker

import (
	"Laman/internal/models"
	"context"

	"github.com/google/uuid"
)

type PickerRepository interface {
	GetOrderByID(ctx context.Context, orderID uuid.UUID) (*models.Order, error)
	GetOrderItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]PickerOrderItem, error)
	GetOrders(ctx context.Context, storeID uuid.UUID) ([]models.Order, error)
	UpdateStatus(ctx context.Context, orderID uuid.UUID, status models.OrderStatus) error
	UpdateStatusAndAssignPicker(ctx context.Context, orderID uuid.UUID, status models.OrderStatus, pickerID uuid.UUID) error
	AssignPicker(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID) error
	AddOrderItem(ctx context.Context, orderID uuid.UUID, name string, price float64, quantity int) (*PickerOrderItem, error)
	RemoveOrderItem(ctx context.Context, itemID uuid.UUID) error
	RecalcOrderTotals(ctx context.Context, orderID uuid.UUID, serviceFeePercent float64) error
}
