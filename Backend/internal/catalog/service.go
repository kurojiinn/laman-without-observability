package catalog

import (
	"Laman/internal/cache"
	"Laman/internal/models"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// CatalogService обрабатывает бизнес-логику, связанную с каталогом,
// включая категории, товары и магазины.
type CatalogService struct {
	categoryRepo     CategoryRepository
	subcategoryRepo  SubcategoryRepository
	productRepo      ProductRepository
	storeRepo        StoreRepository
	reviewRepo       ReviewRepository
	featuredRepo     FeaturedProductRepository
	recipeRepo       RecipeRepository
	scenarioRepo     ScenarioRepository
	storeCatMetaRepo StoreCategoryMetaRepository
	optionsRepo      OptionsRepo   // nil = опции не подгружаются
	rdb              *redis.Client // optional: nil = без кеширования
}

// OptionsRepo — минимальный интерфейс к опциям товара. Объявлен здесь,
// чтобы catalog не зависел от пакета options напрямую (Interface Segregation).
type OptionsRepo interface {
	GetGroupsByProduct(ctx context.Context, productID uuid.UUID) ([]models.ProductOptionGroup, error)
	GetGroupsByProductIDs(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID][]models.ProductOptionGroup, error)
}

// TTL для кеша справочников. Подобраны исходя из частоты изменения данных:
//   - Категории/scenarios: меняет admin раз в несколько часов → 10 мин TTL
//   - Магазины: меняются админом раз в день → 5 мин (учитывает opens_at сезонность)
//   - Featured/Recipes: ручные подборки, меняются раз в день → 10 мин
//   - StoreCategoryMeta: фоны категорий, меняются крайне редко → 30 мин
const (
	cacheTTLLong   = 30 * time.Minute
	cacheTTLMedium = 10 * time.Minute
	cacheTTLShort  = 5 * time.Minute
)

// NewCatalogService создает новый сервис каталога.
func NewCatalogService(
	categoryRepo CategoryRepository,
	subcategoryRepo SubcategoryRepository,
	productRepo ProductRepository,
	storeRepo StoreRepository,
	reviewRepo ReviewRepository,
	featuredRepo FeaturedProductRepository,
	recipeRepo RecipeRepository,
	scenarioRepo ScenarioRepository,
	storeCatMetaRepo StoreCategoryMetaRepository,
) *CatalogService {
	return &CatalogService{
		categoryRepo:     categoryRepo,
		subcategoryRepo:  subcategoryRepo,
		productRepo:      productRepo,
		storeRepo:        storeRepo,
		reviewRepo:       reviewRepo,
		featuredRepo:     featuredRepo,
		recipeRepo:       recipeRepo,
		scenarioRepo:     scenarioRepo,
		storeCatMetaRepo: storeCatMetaRepo,
	}
}

// WithCache подключает Redis-кеш к сервису. Если rdb=nil — кеш отключён,
// все методы работают напрямую с репозиториями (полезно для тестов).
func (s *CatalogService) WithCache(rdb *redis.Client) *CatalogService {
	s.rdb = rdb
	return s
}

// WithOptions подключает репозиторий опций товара. Без него GetProduct и
// списки товаров отдаются без option_groups (обратно-совместимо).
func (s *CatalogService) WithOptions(r OptionsRepo) *CatalogService {
	s.optionsRepo = r
	return s
}

// GetStoreCategoryMeta возвращает настройки фонов типов магазинов.
func (s *CatalogService) GetStoreCategoryMeta(ctx context.Context) ([]models.StoreCategoryMeta, error) {
	return cache.GetOrSet(ctx, s.rdb, cache.KeyStoreCategoryMeta, cacheTTLLong, func() ([]models.StoreCategoryMeta, error) {
		return s.storeCatMetaRepo.GetAll(ctx)
	})
}

// UpdateStoreCategoryImage обновляет фоновое изображение типа магазина.
func (s *CatalogService) UpdateStoreCategoryImage(ctx context.Context, categoryType string, imageURL string) error {
	if err := s.storeCatMetaRepo.UpdateImage(ctx, categoryType, imageURL); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyStoreCategoryMeta)
	return nil
}

// UpdateStoreCategoryMeta обновляет название и описание типа магазина.
func (s *CatalogService) UpdateStoreCategoryMeta(ctx context.Context, categoryType string, name, description string) error {
	if err := s.storeCatMetaRepo.UpdateMeta(ctx, categoryType, name, description); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyStoreCategoryMeta)
	return nil
}

// CreateStoreCategory создаёт новую категорию магазинов.
func (s *CatalogService) CreateStoreCategory(ctx context.Context, id, name string, imageURL *string) (*models.StoreCategoryMeta, error) {
	cat, err := s.storeCatMetaRepo.Create(ctx, id, name, imageURL)
	if err != nil {
		return nil, err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyStoreCategoryMeta)
	return cat, nil
}

// DeleteStoreCategory удаляет категорию магазинов. Магазины этой категории
// остаются, но теряют привязку (category_type становится NULL).
func (s *CatalogService) DeleteStoreCategory(ctx context.Context, id string) error {
	if err := s.storeCatMetaRepo.Delete(ctx, id); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyStoreCategoryMeta)
	cache.InvalidatePattern(ctx, s.rdb, cache.KeyStores+":*")
	return nil
}

// GetCategories получает дерево категорий: каждая категория с её глобальными
// подкатегориями в поле Children.
func (s *CatalogService) GetCategories(ctx context.Context) ([]models.Category, error) {
	return cache.GetOrSet(ctx, s.rdb, cache.KeyCategories, cacheTTLMedium, func() ([]models.Category, error) {
		categories, err := s.categoryRepo.GetAll(ctx)
		if err != nil {
			return nil, fmt.Errorf("не удалось получить категории: %w", err)
		}
		subcategories, err := s.subcategoryRepo.GetAllGlobal(ctx)
		if err != nil {
			return nil, fmt.Errorf("не удалось получить подкатегории: %w", err)
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
	})
}

// GetStoreCategoryTree строит двухуровневое дерево категорий для магазина.
// Глобальные подкатегории товаров магазина группируются под своими категориями;
// магазин-локальные подкатегории отдаются отдельными узлами без детей.
func (s *CatalogService) GetStoreCategoryTree(ctx context.Context, storeID uuid.UUID) ([]models.CategoryNode, error) {
	subcategories, err := s.subcategoryRepo.GetByStoreID(ctx, storeID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить подкатегории магазина: %w", err)
	}

	// Глобальные подкатегории группируем по родительской категории.
	childrenByCategory := make(map[uuid.UUID][]models.CategoryNode)
	categoryOrder := make([]uuid.UUID, 0)
	localNodes := make([]models.CategoryNode, 0)
	for _, sub := range subcategories {
		node := models.CategoryNode{ID: sub.ID, Name: sub.Name, Kind: "subcategory", Children: []models.CategoryNode{}}
		if sub.CategoryID == nil {
			localNodes = append(localNodes, node)
			continue
		}
		if _, seen := childrenByCategory[*sub.CategoryID]; !seen {
			categoryOrder = append(categoryOrder, *sub.CategoryID)
		}
		childrenByCategory[*sub.CategoryID] = append(childrenByCategory[*sub.CategoryID], node)
	}

	tree := make([]models.CategoryNode, 0, len(categoryOrder)+len(localNodes))
	for _, catID := range categoryOrder {
		cat, err := s.categoryRepo.GetByID(ctx, catID)
		if err != nil {
			continue // категория удалена — пропускаем её подкатегории
		}
		tree = append(tree, models.CategoryNode{
			ID:       cat.ID,
			Name:     cat.Name,
			Kind:     "category",
			Children: childrenByCategory[catID],
		})
	}
	tree = append(tree, localNodes...)
	return tree, nil
}

// GetProducts получает товары с опциональными фильтрами (без пагинации).
// Используется в admin/импортах. Для публичных эндпоинтов есть GetProductsWithFilters.
func (s *CatalogService) GetProducts(ctx context.Context, categoryID *uuid.UUID, availableOnly bool) ([]models.Product, error) {
	products, _, err := s.productRepo.GetAll(ctx, categoryID, nil, nil, availableOnly, nil)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары: %w", err)
	}
	return products, nil
}

// GetProductsWithFilters получает товары с расширенными фильтрами и пагинацией.
// page == nil → возвращаются все (для совместимости со старыми вызовами).
func (s *CatalogService) GetProductsWithFilters(
	ctx context.Context,
	categoryID *uuid.UUID,
	subcategoryID *uuid.UUID,
	search *string,
	availableOnly bool,
	page *models.Page,
) ([]models.Product, int, error) {
	products, total, err := s.productRepo.GetAll(ctx, categoryID, subcategoryID, search, availableOnly, page)
	if err != nil {
		return nil, 0, fmt.Errorf("не удалось получить товары: %w", err)
	}
	return products, total, nil
}

// GetStoreProducts получает товары конкретного магазина с пагинацией.
// categoryID != nil — фильтр по всем подкатегориям этой категории.
// Если подключен optionsRepo, к каждому товару прикрепляются option_groups.
func (s *CatalogService) GetStoreProducts(
	ctx context.Context,
	storeID uuid.UUID,
	categoryID *uuid.UUID,
	subcategoryID *uuid.UUID,
	search *string,
	availableOnly bool,
	sort string,
	page *models.Page,
) ([]models.Product, int, error) {
	products, total, err := s.productRepo.GetByStoreID(ctx, storeID, categoryID, subcategoryID, search, availableOnly, sort, page)
	if err != nil {
		return nil, 0, fmt.Errorf("не удалось получить товары магазина: %w", err)
	}
	s.attachOptions(ctx, products)
	return products, total, nil
}

// GetSubcategories получает подкатегории по ID категории.
func (s *CatalogService) GetSubcategories(ctx context.Context, categoryID uuid.UUID) ([]models.Subcategory, error) {
	subcategories, err := s.subcategoryRepo.GetByCategoryID(ctx, categoryID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить подкатегории: %w", err)
	}
	return subcategories, nil
}

// GetStoreSubcategories получает подкатегории товаров магазина.
func (s *CatalogService) GetStoreSubcategories(ctx context.Context, storeID uuid.UUID) ([]models.Subcategory, error) {
	subcategories, err := s.subcategoryRepo.GetByStoreID(ctx, storeID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить подкатегории магазина: %w", err)
	}
	return subcategories, nil
}

// GetStores получает магазины с фильтрацией по типу и поиску.
// Кеширует только версию без поиска — search-варианты слишком разные.
// Архивные магазины (is_active=false) скрыты от клиентов.
func (s *CatalogService) GetStores(ctx context.Context, categoryType *models.StoreCategoryType, search *string) ([]models.Store, error) {
	if search == nil && categoryType == nil {
		return cache.GetOrSet(ctx, s.rdb, cache.KeyStores+":all", cacheTTLShort, func() ([]models.Store, error) {
			return s.storeRepo.GetAll(ctx, nil, nil, false)
		})
	}
	stores, err := s.storeRepo.GetAll(ctx, categoryType, search, false)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить магазины: %w", err)
	}
	return stores, nil
}

// GetAllStoresIncludingArchived возвращает магазины с архивными — для admin-панели.
// Не кеширует, т.к. админ-данные меняются часто и не должны протухать.
func (s *CatalogService) GetAllStoresIncludingArchived(ctx context.Context) ([]models.Store, error) {
	stores, err := s.storeRepo.GetAll(ctx, nil, nil, true)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить магазины: %w", err)
	}
	return stores, nil
}

// GetStore получает магазин по ID.
func (s *CatalogService) GetStore(ctx context.Context, id uuid.UUID) (*models.Store, error) {
	store, err := s.storeRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить магазин: %w", err)
	}
	return store, nil
}

// GetProduct получает товар по ID. Если подключен optionsRepo, дополняет option_groups.
func (s *CatalogService) GetProduct(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	product, err := s.productRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товар: %w", err)
	}
	if s.optionsRepo != nil {
		groups, err := s.optionsRepo.GetGroupsByProduct(ctx, product.ID)
		if err == nil {
			product.OptionGroups = groups
		}
	}
	return product, nil
}

// attachOptions добавляет option_groups в каждый product (батчем). Тихий помощник —
// если опции не подключены или возникла ошибка, продукты возвращаются без них.
func (s *CatalogService) attachOptions(ctx context.Context, products []models.Product) {
	if s.optionsRepo == nil || len(products) == 0 {
		return
	}
	ids := make([]uuid.UUID, len(products))
	for i, p := range products {
		ids[i] = p.ID
	}
	groupsMap, err := s.optionsRepo.GetGroupsByProductIDs(ctx, ids)
	if err != nil {
		return
	}
	for i := range products {
		products[i].OptionGroups = groupsMap[products[i].ID]
	}
}

// GetReviews возвращает все отзывы для магазина.
func (s *CatalogService) GetReviews(ctx context.Context, storeID uuid.UUID) ([]models.Review, error) {
	reviews, err := s.reviewRepo.GetByStoreID(ctx, storeID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить отзывы: %w", err)
	}
	return reviews, nil
}

// CanUserReview возвращает true если у пользователя есть доставленный заказ
// из этого магазина и он ещё не оставлял отзыв.
func (s *CatalogService) CanUserReview(ctx context.Context, storeID uuid.UUID, userID uuid.UUID) (bool, error) {
	hasOrder, err := s.reviewRepo.HasDeliveredOrder(ctx, storeID, userID)
	if err != nil {
		return false, fmt.Errorf("не удалось проверить заказы: %w", err)
	}
	return hasOrder, nil
}

// UpdateProduct обновляет поля товара (только для ADMIN).
func (s *CatalogService) UpdateProduct(ctx context.Context, id uuid.UUID, name string, price float64, description *string, isAvailable bool) (*models.Product, error) {
	product, err := s.productRepo.Update(ctx, id, name, price, description, isAvailable)
	if err != nil {
		return nil, fmt.Errorf("не удалось обновить товар: %w", err)
	}
	// Товар может быть в featured, рецептах — сбрасываем все каталожные кеши
	s.invalidateCatalogCache(ctx)
	return product, nil
}

// UpdateProductImage обновляет только фото товара (только для ADMIN).
func (s *CatalogService) UpdateProductImage(ctx context.Context, id uuid.UUID, imageURL string) (*models.Product, error) {
	product, err := s.productRepo.UpdateImage(ctx, id, imageURL)
	if err != nil {
		return nil, fmt.Errorf("не удалось обновить фото товара: %w", err)
	}
	s.invalidateCatalogCache(ctx)
	return product, nil
}

// UpdateStore обновляет поля магазина (только для ADMIN).
func (s *CatalogService) UpdateStore(ctx context.Context, id uuid.UUID, name string, address string, description *string, opensAt *string, closesAt *string) (*models.Store, error) {
	store, err := s.storeRepo.Update(ctx, id, name, address, description, opensAt, closesAt)
	if err != nil {
		return nil, fmt.Errorf("не удалось обновить магазин: %w", err)
	}
	cache.InvalidatePattern(ctx, s.rdb, cache.KeyStores+":*")
	return store, nil
}

// invalidateCatalogCache сбрасывает кеш блоков, зависящих от изменения товаров:
// featured (хранит products), recipes (хранит products), scenarios (нет, но недорого).
func (s *CatalogService) invalidateCatalogCache(ctx context.Context) {
	cache.InvalidatePattern(ctx, s.rdb, "cache:featured:*")
	cache.Invalidate(ctx, s.rdb, cache.KeyRecipes)
}

// DeleteReview удаляет отзыв (только для ADMIN).
func (s *CatalogService) DeleteReview(ctx context.Context, reviewID uuid.UUID) error {
	if err := s.reviewRepo.Delete(ctx, reviewID); err != nil {
		return fmt.Errorf("не удалось удалить отзыв: %w", err)
	}
	return nil
}

// DeleteOwnReview удаляет отзыв, если он принадлежит пользователю.
func (s *CatalogService) DeleteOwnReview(ctx context.Context, reviewID uuid.UUID, userID uuid.UUID) error {
	return s.reviewRepo.DeleteByOwner(ctx, reviewID, userID)
}

// CreateReview создаёт отзыв, предварительно проверяя право пользователя.
func (s *CatalogService) CreateReview(ctx context.Context, storeID uuid.UUID, userID uuid.UUID, rating int, comment string) (*models.Review, error) {
	canReview, err := s.CanUserReview(ctx, storeID, userID)
	if err != nil {
		return nil, err
	}
	if !canReview {
		return nil, fmt.Errorf("нет заказа из этого магазина")
	}
	review := &models.Review{
		StoreID: storeID,
		UserID:  userID,
		Rating:  rating,
		Comment: comment,
	}
	if err := s.reviewRepo.Create(ctx, review); err != nil {
		return nil, fmt.Errorf("не удалось сохранить отзыв: %w", err)
	}
	return review, nil
}

// GetFeaturedProducts возвращает товары блока витрины.
func (s *CatalogService) GetFeaturedProducts(ctx context.Context, blockType models.FeaturedBlockType) ([]models.Product, error) {
	key := cache.FormatKey(cache.KeyFeatured, blockType)
	return cache.GetOrSet(ctx, s.rdb, key, cacheTTLShort, func() ([]models.Product, error) {
		return s.featuredRepo.GetByBlock(ctx, blockType)
	})
}

// GetRecipes возвращает все рецепты вместе с ингредиентами.
func (s *CatalogService) GetRecipes(ctx context.Context) ([]models.RecipeWithProducts, error) {
	return cache.GetOrSet(ctx, s.rdb, cache.KeyRecipes, cacheTTLMedium, func() ([]models.RecipeWithProducts, error) {
		return s.recipeRepo.GetAll(ctx)
	})
}

// GetRecipe возвращает рецепт с ингредиентами по ID.
func (s *CatalogService) GetRecipe(ctx context.Context, id uuid.UUID) (*models.RecipeWithProducts, error) {
	return s.recipeRepo.GetByID(ctx, id)
}

// CreateRecipe создаёт новый рецепт.
func (s *CatalogService) CreateRecipe(ctx context.Context, recipe *models.Recipe) error {
	if recipe.Name == "" {
		return fmt.Errorf("название обязательно")
	}
	if err := s.recipeRepo.Create(ctx, recipe); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyRecipes)
	return nil
}

// UpdateRecipe обновляет рецепт.
func (s *CatalogService) UpdateRecipe(ctx context.Context, id uuid.UUID, name string, description *string, imageURL *string, position int) (*models.Recipe, error) {
	r, err := s.recipeRepo.Update(ctx, id, name, description, imageURL, position)
	if err == nil {
		cache.Invalidate(ctx, s.rdb, cache.KeyRecipes)
	}
	return r, err
}

// DeleteRecipe удаляет рецепт.
func (s *CatalogService) DeleteRecipe(ctx context.Context, id uuid.UUID) error {
	if err := s.recipeRepo.Delete(ctx, id); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyRecipes)
	return nil
}

// AddRecipeProduct добавляет ингредиент к рецепту.
func (s *CatalogService) AddRecipeProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID, quantity int) error {
	if err := s.recipeRepo.AddProduct(ctx, recipeID, productID, quantity); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyRecipes)
	return nil
}

// RemoveRecipeProduct убирает ингредиент из рецепта.
func (s *CatalogService) RemoveRecipeProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID) error {
	if err := s.recipeRepo.RemoveProduct(ctx, recipeID, productID); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyRecipes)
	return nil
}

// GetActiveScenarios возвращает активные сценарии для главного экрана.
func (s *CatalogService) GetActiveScenarios(ctx context.Context) ([]models.Scenario, error) {
	return cache.GetOrSet(ctx, s.rdb, cache.KeyScenarios, cacheTTLMedium, func() ([]models.Scenario, error) {
		return s.scenarioRepo.GetActive(ctx)
	})
}

// GetAllScenarios возвращает все сценарии (для admin).
func (s *CatalogService) GetAllScenarios(ctx context.Context) ([]models.Scenario, error) {
	return s.scenarioRepo.GetAll(ctx)
}

// CreateScenario создаёт новый сценарий.
func (s *CatalogService) CreateScenario(ctx context.Context, sc models.Scenario) (*models.Scenario, error) {
	if sc.Label == "" {
		return nil, fmt.Errorf("название обязательно")
	}
	created, err := s.scenarioRepo.Create(ctx, sc)
	if err == nil {
		cache.Invalidate(ctx, s.rdb, cache.KeyScenarios)
	}
	return created, err
}

// UpdateScenario обновляет сценарий.
func (s *CatalogService) UpdateScenario(ctx context.Context, id uuid.UUID, sc models.Scenario) (*models.Scenario, error) {
	updated, err := s.scenarioRepo.Update(ctx, id, sc)
	if err == nil {
		cache.Invalidate(ctx, s.rdb, cache.KeyScenarios)
	}
	return updated, err
}

// DeleteScenario удаляет сценарий.
func (s *CatalogService) DeleteScenario(ctx context.Context, id uuid.UUID) error {
	if err := s.scenarioRepo.Delete(ctx, id); err != nil {
		return err
	}
	cache.Invalidate(ctx, s.rdb, cache.KeyScenarios)
	return nil
}
