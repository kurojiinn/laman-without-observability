package admin

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"Laman/internal/models"
	"Laman/internal/observability"
	"Laman/internal/push"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// Service содержит бизнес-логику admin-операций.
type Service struct {
	repo   Repository
	logger *zap.Logger
	pusher *push.Service
}

// NewService создает сервис admin-операций.
func NewService(repo Repository, logger *zap.Logger, pusher *push.Service) *Service {
	return &Service{repo: repo, logger: logger, pusher: pusher}
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

// UpdateStore обновляет поля магазина.
func (s *Service) UpdateStore(ctx context.Context, id uuid.UUID, name, address, city, description string, categoryType models.StoreCategoryType) error {
	return s.repo.UpdateStore(ctx, id, name, address, city, description, categoryType)
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
		// разрешено
	default:
		return errInvalidStatus
	}

	if err := s.repo.UpdateOrderStatus(ctx, id, models.OrderStatus(normalized)); err != nil {
		return err
	}

	// Push клиенту по новому статусу.
	if s.pusher != nil {
		if userID, err := s.repo.GetOrderUserID(ctx, id); err == nil && userID != nil {
			if n, ok := push.NotificationForOrderStatus(id.String(), normalized); ok {
				s.pusher.SendToUser(ctx, *userID, n)
			}
		}
	}
	return nil
}

// ImportResult описывает результат массового импорта.
type ImportResult struct {
	Inserted int
}

// GetCategories возвращает все категории.
func (s *Service) GetCategories(ctx context.Context) ([]models.Category, error) {
	return s.repo.GetCategories(ctx)
}

// CreateCategory создаёт новую категорию.
func (s *Service) CreateCategory(ctx context.Context, name string, imageURL *string) (*models.Category, error) {
	cat := &models.Category{
		ID:       uuid.New(),
		Name:     strings.TrimSpace(name),
		ImageURL: imageURL,
	}
	if err := s.repo.CreateCategory(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

// UpdateCategoryImage обновляет изображение категории.
func (s *Service) UpdateCategoryImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	return s.repo.UpdateCategoryImage(ctx, id, imageURL)
}

// UpdateCategoryName обновляет название категории.
func (s *Service) UpdateCategoryName(ctx context.Context, id uuid.UUID, name string) error {
	return s.repo.UpdateCategoryName(ctx, id, name)
}

// DeleteCategory удаляет категорию без удаления товаров.
func (s *Service) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteCategory(ctx, id)
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

// CreatePickerRequest описывает запрос на создание сборщика.
type CreatePickerRequest struct {
	Phone    string    `json:"phone"`
	Password string    `json:"password"`
	StoreID  uuid.UUID `json:"store_id"`
}

// CreatePicker создаёт сборщика, привязанного к магазину.
func (s *Service) CreatePicker(ctx context.Context, req *CreatePickerRequest) (*PickerInfo, error) {
	phone := strings.TrimSpace(req.Phone)
	password := strings.TrimSpace(req.Password)
	if phone == "" || password == "" || req.StoreID == uuid.Nil {
		return nil, fmt.Errorf("phone, password и store_id обязательны")
	}
	if len(password) < 6 {
		return nil, fmt.Errorf("пароль должен быть минимум 6 символов")
	}

	taken, err := s.repo.IsPhoneTaken(ctx, phone)
	if err != nil {
		return nil, fmt.Errorf("не удалось проверить телефон: %w", err)
	}
	if taken {
		return nil, fmt.Errorf("пользователь с таким телефоном уже существует")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("не удалось хешировать пароль: %w", err)
	}
	hashStr := string(hash)
	storeID := req.StoreID
	now := time.Now().UTC()

	user := &models.User{
		ID:           uuid.New(),
		Phone:        phone,
		Role:         models.UserRolePicker,
		StoreID:      &storeID,
		PasswordHash: &hashStr,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.CreatePicker(ctx, user); err != nil {
		return nil, fmt.Errorf("не удалось создать сборщика: %w", err)
	}

	pickers, err := s.repo.GetPickers(ctx)
	if err != nil {
		return nil, fmt.Errorf("создан, но не удалось получить данные: %w", err)
	}
	for _, p := range pickers {
		if p.ID == user.ID {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("создан, но не найден в списке")
}

// GetPickers возвращает всех сборщиков с привязкой к магазинам.
func (s *Service) GetPickers(ctx context.Context) ([]PickerInfo, error) {
	return s.repo.GetPickers(ctx)
}

// DeletePicker удаляет сборщика по ID.
func (s *Service) DeletePicker(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeletePicker(ctx, id)
}

// UpdatePickerStore меняет магазин сборщика.
func (s *Service) UpdatePickerStore(ctx context.Context, id uuid.UUID, storeID uuid.UUID) error {
	if storeID == uuid.Nil {
		return fmt.Errorf("store_id обязателен")
	}
	return s.repo.UpdatePickerStore(ctx, id, storeID)
}

// UpdatePickerPassword меняет пароль сборщика (с bcrypt).
func (s *Service) UpdatePickerPassword(ctx context.Context, id uuid.UUID, password string) error {
	password = strings.TrimSpace(password)
	if len(password) < 6 {
		return fmt.Errorf("пароль должен быть минимум 6 символов")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("не удалось хешировать пароль: %w", err)
	}
	return s.repo.UpdatePickerPassword(ctx, id, string(hash))
}
