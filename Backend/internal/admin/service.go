package admin

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"Laman/internal/models"
	"Laman/internal/observability"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service содержит бизнес-логику admin-операций.
type Service struct {
	repo   Repository
	logger *zap.Logger
}

// NewService создает сервис admin-операций.
func NewService(repo Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

// GetDashboardStats возвращает сводные метрики.
func (s *Service) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats, err := s.repo.GetDashboardStats(ctx)
	if err == nil {
		activeOrdersGauge.Set(float64(stats.ActiveOrdersCount))
	}
	return stats, err
}

// CreateStore создает магазин.
func (s *Service) CreateStore(ctx context.Context, req *CreateStoreRequest) (*models.Store, error) {
	store := newStoreFromRequest(req)
	if err := s.repo.CreateStore(ctx, store); err != nil {
		return nil, err
	}
	return store, nil
}

// CreateProduct создает товар.
func (s *Service) CreateProduct(ctx context.Context, req *CreateProductRequest) (*models.Product, error) {
	product := newProductFromRequest(req)
	if err := s.repo.CreateProduct(ctx, product); err != nil {
		return nil, err
	}
	return product, nil
}

// GetProductsByStore возвращает товары магазина.
func (s *Service) GetProductsByStore(ctx context.Context, storeID uuid.UUID) ([]models.Product, error) {
	return s.repo.GetProductsByStore(ctx, storeID)
}

// UpdateProduct обновляет товар.
func (s *Service) UpdateProduct(ctx context.Context, id uuid.UUID, req *UpdateProductRequest) (*models.Product, error) {
	return s.repo.UpdateProduct(ctx, id, req)
}

// GetAllOrders возвращает все заказы за последние 90 дней.
func (s *Service) GetAllOrders(ctx context.Context) ([]models.Order, error) {
	return s.repo.GetAllOrders(ctx)
}

// DeleteStore удаляет магазин и связанные товары.
func (s *Service) DeleteStore(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteStore(ctx, id)
}

// DeleteProduct удаляет товар по ID.
func (s *Service) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteProduct(ctx, id)
}

// UpdateOrderStatus обновляет статус заказа.
func (s *Service) UpdateOrderStatus(ctx context.Context, id uuid.UUID, status string) error {
	normalized := strings.ToUpper(strings.TrimSpace(status))
	switch normalized {
	case string(models.OrderStatusNew),
		string(models.OrderStatusAcceptedByPicker),
		string(models.OrderStatusAssembling),
		string(models.OrderStatusAssembled),
		string(models.OrderStatusWaitingCourier),
		string(models.OrderStatusCourierPickedUp),
		string(models.OrderStatusDelivering),
		string(models.OrderStatusDelivered),
		string(models.OrderStatusCancelled),
		string(models.OrderStatusNeedsConfirmation):
		return s.repo.UpdateOrderStatus(ctx, id, models.OrderStatus(normalized))
	default:
		return errInvalidStatus
	}
}

// ImportResult описывает результат массового импорта.
type ImportResult struct {
	Inserted int
}

// ImportProducts выполняет массовый импорт товаров из Excel/CSV.
func (s *Service) ImportProducts(ctx context.Context, filePath string, originalName string) (*ImportResult, error) {
	ctx, span := observability.StartSpan(ctx, "admin.import_products.service")
	defer span.End()

	start := time.Now()
	ext := strings.ToLower(filepath.Ext(originalName))
	rows, err := parseImportFile(filePath, ext)
	if err != nil {
		s.logger.Error("Импорт товаров: ошибка парсинга файла", zap.Error(err))
		return nil, err
	}

	categoryMap, storeMap, err := s.repo.GetCategoryAndStoreMaps(ctx)
	if err != nil {
		s.logger.Error("Импорт товаров: не удалось загрузить справочники", zap.Error(err))
		return nil, fmt.Errorf("не удалось загрузить справочники категорий/магазинов")
	}

	products := make([]ImportProductRow, 0, len(rows))
	for _, row := range rows {
		categoryID, ok := categoryMap[strings.ToLower(row.CategoryName)]
		if !ok {
			return nil, fmt.Errorf("категория '%s' не найдена (строка %d)", row.CategoryName, row.RowNumber)
		}
		storeID, ok := storeMap[strings.ToLower(row.StoreName)]
		if !ok {
			return nil, fmt.Errorf("магазин '%s' не найден (строка %d)", row.StoreName, row.RowNumber)
		}
		products = append(products, ImportProductRow{
			RowNumber:   row.RowNumber,
			Name:        row.Name,
			Price:       row.Price,
			Description: row.Description,
			CategoryID:  categoryID,
			StoreID:     storeID,
		})
	}

	s.logger.Info("Импорт товаров: запись в БД", zap.Int("count", len(products)))
	if err := s.repo.BulkInsertProducts(ctx, products); err != nil {
		s.logger.Error("Импорт товаров: ошибка записи в БД", zap.Error(err))
		return nil, fmt.Errorf("ошибка записи в БД")
	}

	s.logger.Info("Импорт товаров: завершен",
		zap.Int("inserted", len(products)),
		zap.Duration("duration", time.Since(start)),
	)

	return &ImportResult{Inserted: len(products)}, nil
}
