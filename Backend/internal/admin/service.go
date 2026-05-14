package admin

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"Laman/internal/cache"
	"Laman/internal/models"
	"Laman/internal/observability"
	"Laman/internal/push"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// Service содержит бизнес-логику admin-операций.
type Service struct {
	repo   Repository
	logger *zap.Logger
	pusher *push.Service
	rdb    *redis.Client // optional: nil = без инвалидации кеша
}

// NewService создает сервис admin-операций.
func NewService(repo Repository, logger *zap.Logger, pusher *push.Service) *Service {
	return &Service{repo: repo, logger: logger, pusher: pusher}
}

// WithCache подключает Redis-клиент для инвалидации кешей при мутациях.
// Без него admin-операции работают, но кеш списка магазинов протухнет только по TTL (5 мин).
func (s *Service) WithCache(rdb *redis.Client) *Service {
	s.rdb = rdb
	return s
}

// invalidateStoresCache сбрасывает кеш списка магазинов в Redis.
// Вызывается после любой мутации stores, иначе клиенты до 5 минут видят старый список.
func (s *Service) invalidateStoresCache(ctx context.Context) {
	if s.rdb == nil {
		return
	}
	cache.InvalidatePattern(ctx, s.rdb, cache.KeyStores+":*")
}

// invalidateFeaturedCache сбрасывает кеш блоков витрины.
// Без него клиент (и сама админка через /catalog/featured) до 5 минут
// видят старый состав блока — добавленный товар не появляется, удалённый не исчезает.
func (s *Service) invalidateFeaturedCache(ctx context.Context) {
	if s.rdb == nil {
		return
	}
	cache.InvalidatePattern(ctx, s.rdb, "cache:featured:*")
}

// AddFeatured добавляет товар в блок витрины и сбрасывает кеш витрины.
func (s *Service) AddFeatured(ctx context.Context, fp *models.FeaturedProduct) error {
	if err := s.repo.AddFeatured(ctx, fp); err != nil {
		return err
	}
	s.invalidateFeaturedCache(ctx)
	return nil
}

// DeleteFeatured убирает товар из блока витрины и сбрасывает кеш витрины.
func (s *Service) DeleteFeatured(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.DeleteFeatured(ctx, id); err != nil {
		return err
	}
	s.invalidateFeaturedCache(ctx)
	return nil
}

// GetDashboardStats возвращает сводные метрики.
func (s *Service) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats, err := s.repo.GetDashboardStats(ctx)
	if err == nil {
		activeOrdersGauge.Set(float64(stats.ActiveOrdersCount))
	}
	return stats, err
}

// ListStores возвращает все магазины, включая архивные.
func (s *Service) ListStores(ctx context.Context) ([]models.Store, error) {
	return s.repo.ListStores(ctx)
}

// CreateStore создает магазин.
func (s *Service) CreateStore(ctx context.Context, req *CreateStoreRequest) (*models.Store, error) {
	store := newStoreFromRequest(req)
	if err := s.repo.CreateStore(ctx, store); err != nil {
		return nil, err
	}
	s.invalidateStoresCache(ctx)
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
	if err := s.repo.UpdateStore(ctx, id, name, address, city, description, categoryType); err != nil {
		return err
	}
	s.invalidateStoresCache(ctx)
	return nil
}

// UpdateStoreImage обновляет фото магазина и сбрасывает кеш.
func (s *Service) UpdateStoreImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	if err := s.repo.UpdateStoreImage(ctx, id, imageURL); err != nil {
		return err
	}
	s.invalidateStoresCache(ctx)
	return nil
}

// ErrStoreHasDependencies возвращается, когда магазин нельзя удалить физически,
// потому что по нему есть заказы или к нему привязаны сборщики.
// В этом случае клиент должен предложить архивацию.
type ErrStoreHasDependencies struct {
	Orders  int
	Pickers int
}

func (e *ErrStoreHasDependencies) Error() string {
	return fmt.Sprintf("у магазина есть зависимости: orders=%d pickers=%d", e.Orders, e.Pickers)
}

// DeleteStore удаляет магазин и связанные товары.
// Если есть заказы или сборщики — возвращает *ErrStoreHasDependencies и не пытается удалять.
func (s *Service) DeleteStore(ctx context.Context, id uuid.UUID) error {
	orders, pickers, err := s.repo.StoreHasDependencies(ctx, id)
	if err != nil {
		return err
	}
	if orders > 0 || pickers > 0 {
		return &ErrStoreHasDependencies{Orders: orders, Pickers: pickers}
	}
	if err := s.repo.DeleteStore(ctx, id); err != nil {
		return err
	}
	s.invalidateStoresCache(ctx)
	return nil
}

// ArchiveStore помечает магазин архивным — он исчезает из клиентского каталога,
// но история заказов и сборщики сохраняются.
func (s *Service) ArchiveStore(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.ArchiveStore(ctx, id); err != nil {
		return err
	}
	s.invalidateStoresCache(ctx)
	return nil
}

// RestoreStore возвращает архивный магазин в активное состояние.
func (s *Service) RestoreStore(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.RestoreStore(ctx, id); err != nil {
		return err
	}
	s.invalidateStoresCache(ctx)
	return nil
}

// GetStoreSubcategories — подкатегории, привязанные к магазину.
func (s *Service) GetStoreSubcategories(ctx context.Context, storeID uuid.UUID) ([]models.Subcategory, error) {
	return s.repo.GetStoreSubcategories(ctx, storeID)
}

// CreateStoreSubcategory создаёт категорию или подкатегорию магазина.
// parentID != nil — подкатегория второго уровня внутри категории parentID.
func (s *Service) CreateStoreSubcategory(ctx context.Context, storeID uuid.UUID, name string, parentID *uuid.UUID) (*models.Subcategory, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("название обязательно")
	}
	if len(name) > 100 {
		return nil, fmt.Errorf("название слишком длинное")
	}
	return s.repo.CreateStoreSubcategory(ctx, storeID, name, parentID)
}

// UpdateStoreSubcategory переименовывает категорию/подкатегорию магазина.
func (s *Service) UpdateStoreSubcategory(ctx context.Context, storeID, subID uuid.UUID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("название обязательно")
	}
	if len(name) > 100 {
		return fmt.Errorf("название слишком длинное")
	}
	return s.repo.UpdateStoreSubcategory(ctx, storeID, subID, name)
}

// DeleteStoreSubcategory удаляет категорию/подкатегорию магазина.
// При удалении категории её подкатегории удаляются каскадно; товары остаются,
// но теряют привязку (subcategory_id → NULL).
func (s *Service) DeleteStoreSubcategory(ctx context.Context, storeID, subID uuid.UUID) error {
	return s.repo.DeleteStoreSubcategory(ctx, storeID, subID)
}

// CountProductsInSubcategory нужен для предупреждения «отвяжем N товаров».
func (s *Service) CountProductsInSubcategory(ctx context.Context, subID uuid.UUID) (int, error) {
	return s.repo.CountProductsInSubcategory(ctx, subID)
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

// invalidateCategoriesCache сбрасывает кеш дерева категорий в Redis.
// Вызывается после любой мутации categories/subcategories, иначе клиент
// до 10 минут видит старое дерево.
func (s *Service) invalidateCategoriesCache(ctx context.Context) {
	if s.rdb == nil {
		return
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyCategories)
}

// GetCategories возвращает дерево категорий: каждая категория с её
// глобальными подкатегориями в поле Children.
func (s *Service) GetCategories(ctx context.Context) ([]models.Category, error) {
	categories, err := s.repo.GetCategories(ctx)
	if err != nil {
		return nil, err
	}
	subcategories, err := s.repo.GetGlobalSubcategories(ctx)
	if err != nil {
		return nil, err
	}
	childrenByCategory := make(map[uuid.UUID][]models.Subcategory, len(categories))
	for _, sub := range subcategories {
		if sub.CategoryID != nil {
			childrenByCategory[*sub.CategoryID] = append(childrenByCategory[*sub.CategoryID], sub)
		}
	}
	for i := range categories {
		children := childrenByCategory[categories[i].ID]
		if children == nil {
			children = []models.Subcategory{}
		}
		categories[i].Children = children
	}
	return categories, nil
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
	s.invalidateCategoriesCache(ctx)
	return cat, nil
}

// UpdateCategoryImage обновляет изображение категории.
func (s *Service) UpdateCategoryImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	if err := s.repo.UpdateCategoryImage(ctx, id, imageURL); err != nil {
		return err
	}
	s.invalidateCategoriesCache(ctx)
	return nil
}

// UpdateCategoryName обновляет название категории.
func (s *Service) UpdateCategoryName(ctx context.Context, id uuid.UUID, name string) error {
	if err := s.repo.UpdateCategoryName(ctx, id, name); err != nil {
		return err
	}
	s.invalidateCategoriesCache(ctx)
	return nil
}

// DeleteCategory удаляет категорию без удаления товаров.
func (s *Service) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.DeleteCategory(ctx, id); err != nil {
		return err
	}
	s.invalidateCategoriesCache(ctx)
	return nil
}

// CreateSubcategory создаёт глобальную подкатегорию внутри категории.
func (s *Service) CreateSubcategory(ctx context.Context, categoryID uuid.UUID, name string) (*models.Subcategory, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("название обязательно")
	}
	if len(name) > 100 {
		return nil, fmt.Errorf("название слишком длинное")
	}
	sub, err := s.repo.CreateGlobalSubcategory(ctx, categoryID, name)
	if err != nil {
		return nil, err
	}
	s.invalidateCategoriesCache(ctx)
	return sub, nil
}

// UpdateSubcategoryName переименовывает глобальную подкатегорию.
func (s *Service) UpdateSubcategoryName(ctx context.Context, id uuid.UUID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("название обязательно")
	}
	if len(name) > 100 {
		return fmt.Errorf("название слишком длинное")
	}
	if err := s.repo.UpdateSubcategoryName(ctx, id, name); err != nil {
		return err
	}
	s.invalidateCategoriesCache(ctx)
	return nil
}

// DeleteSubcategory удаляет глобальную подкатегорию (товары остаются, ссылка обнулится).
func (s *Service) DeleteSubcategory(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.DeleteSubcategory(ctx, id); err != nil {
		return err
	}
	s.invalidateCategoriesCache(ctx)
	return nil
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

	// Кеш: (storeID, нижний_регистр_имя) → subcategory_id. Заполняется лениво:
	// при первом запросе подкатегория ищется среди уже привязанных к магазину,
	// иначе создаётся новая.
	subcategoryCache := make(map[string]uuid.UUID)
	resolveSubcategory := func(storeID uuid.UUID, name string) (*uuid.UUID, error) {
		name = strings.TrimSpace(name)
		if name == "" {
			return nil, nil
		}
		key := storeID.String() + "|" + strings.ToLower(name)
		if id, ok := subcategoryCache[key]; ok {
			return &id, nil
		}
		existing, err := s.repo.GetStoreSubcategories(ctx, storeID)
		if err != nil {
			return nil, fmt.Errorf("не удалось получить подкатегории магазина: %w", err)
		}
		for _, sub := range existing {
			if strings.EqualFold(sub.Name, name) {
				subcategoryCache[key] = sub.ID
				id := sub.ID
				return &id, nil
			}
		}
		created, err := s.repo.CreateStoreSubcategory(ctx, storeID, name, nil)
		if err != nil {
			return nil, fmt.Errorf("не удалось создать подкатегорию '%s': %w", name, err)
		}
		subcategoryCache[key] = created.ID
		id := created.ID
		return &id, nil
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
		subID, err := resolveSubcategory(storeID, row.SubcategoryName)
		if err != nil {
			return nil, fmt.Errorf("строка %d: %w", row.RowNumber, err)
		}
		products = append(products, ImportProductRow{
			RowNumber:     row.RowNumber,
			Name:          row.Name,
			Price:         row.Price,
			Description:   row.Description,
			CategoryID:    categoryID,
			StoreID:       storeID,
			SubcategoryID: subID,
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
