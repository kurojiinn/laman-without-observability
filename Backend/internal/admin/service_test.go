package admin

import (
	"context"
	"testing"

	"Laman/internal/models"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

type adminRepoMock struct {
	lastStatus models.OrderStatus
	lastOrder  uuid.UUID
}

func (m *adminRepoMock) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	return &DashboardStats{}, nil
}

func (m *adminRepoMock) GetActiveOrders(ctx context.Context) ([]models.Order, error) {
	return []models.Order{}, nil
}

func (m *adminRepoMock) CreateStore(ctx context.Context, store *models.Store) error {
	return nil
}

func (m *adminRepoMock) DeleteStore(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *adminRepoMock) CreateProduct(ctx context.Context, product *models.Product) error {
	return nil
}

func (m *adminRepoMock) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *adminRepoMock) UpdateOrderStatus(ctx context.Context, id uuid.UUID, status models.OrderStatus) error {
	m.lastOrder = id
	m.lastStatus = status
	return nil
}

func (m *adminRepoMock) GetCategoryAndStoreMaps(ctx context.Context) (map[string]uuid.UUID, map[string]uuid.UUID, error) {
	return map[string]uuid.UUID{}, map[string]uuid.UUID{}, nil
}

func (m *adminRepoMock) BulkInsertProducts(ctx context.Context, rows []ImportProductRow) error {
	return nil
}

func (m *adminRepoMock) GetProductsByStore(ctx context.Context, storeID uuid.UUID) ([]models.Product, error) {
	return []models.Product{}, nil
}

func (m *adminRepoMock) UpdateProduct(ctx context.Context, id uuid.UUID, req *UpdateProductRequest) (*models.Product, error) {
	return &models.Product{}, nil
}

func TestUpdateOrderStatus_Valid(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewService(repo, zap.NewNop())
	orderID := uuid.New()

	err := service.UpdateOrderStatus(context.Background(), orderID, "delivered")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if repo.lastOrder != orderID {
		t.Fatalf("expected order ID %s, got %s", orderID, repo.lastOrder)
	}
	if repo.lastStatus != models.OrderStatusDelivered {
		t.Fatalf("expected status %s, got %s", models.OrderStatusDelivered, repo.lastStatus)
	}
}

func TestUpdateOrderStatus_Invalid(t *testing.T) {
	repo := &adminRepoMock{}
	service := NewService(repo, zap.NewNop())

	err := service.UpdateOrderStatus(context.Background(), uuid.New(), "UNKNOWN_STATUS")
	if err == nil {
		t.Fatal("expected validation error for unknown status")
	}
}
