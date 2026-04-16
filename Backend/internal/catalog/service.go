package catalog

import (
	"Laman/internal/models"
	"context"
	"fmt"
	"github.com/google/uuid"
)

// CatalogService обрабатывает бизнес-логику, связанную с каталогом,
// включая категории, товары и магазины.
type CatalogService struct {
	categoryRepo    CategoryRepository
	subcategoryRepo SubcategoryRepository
	productRepo     ProductRepository
	storeRepo       StoreRepository
	reviewRepo      ReviewRepository
	featuredRepo    FeaturedProductRepository
}

// NewCatalogService создает новый сервис каталога.
func NewCatalogService(
	categoryRepo CategoryRepository,
	subcategoryRepo SubcategoryRepository,
	productRepo ProductRepository,
	storeRepo StoreRepository,
	reviewRepo ReviewRepository,
	featuredRepo FeaturedProductRepository,
) *CatalogService {
	return &CatalogService{
		categoryRepo:    categoryRepo,
		subcategoryRepo: subcategoryRepo,
		productRepo:     productRepo,
		storeRepo:       storeRepo,
		reviewRepo:      reviewRepo,
		featuredRepo:    featuredRepo,
	}
}

// GetCategories получает все категории.
func (s *CatalogService) GetCategories(ctx context.Context) ([]models.Category, error) {
	categories, err := s.categoryRepo.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить категории: %w", err)
	}
	return categories, nil
}

// GetProducts получает товары с опциональными фильтрами.
func (s *CatalogService) GetProducts(ctx context.Context, categoryID *uuid.UUID, availableOnly bool) ([]models.Product, error) {
	products, err := s.productRepo.GetAll(ctx, categoryID, nil, nil, availableOnly)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары: %w", err)
	}
	return products, nil
}

// GetProductsWithFilters получает товары с расширенными фильтрами.
func (s *CatalogService) GetProductsWithFilters(
	ctx context.Context,
	categoryID *uuid.UUID,
	subcategoryID *uuid.UUID,
	search *string,
	availableOnly bool,
) ([]models.Product, error) {
	products, err := s.productRepo.GetAll(ctx, categoryID, subcategoryID, search, availableOnly)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары: %w", err)
	}
	return products, nil
}

// GetStoreProducts получает товары конкретного магазина.
func (s *CatalogService) GetStoreProducts(
	ctx context.Context,
	storeID uuid.UUID,
	subcategoryID *uuid.UUID,
	search *string,
	availableOnly bool,
) ([]models.Product, error) {
	products, err := s.productRepo.GetByStoreID(ctx, storeID, subcategoryID, search, availableOnly)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары магазина: %w", err)
	}
	return products, nil
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
func (s *CatalogService) GetStores(ctx context.Context, categoryType *models.StoreCategoryType, search *string) ([]models.Store, error) {
	stores, err := s.storeRepo.GetAll(ctx, categoryType, search)
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

// GetProduct получает товар по ID.
func (s *CatalogService) GetProduct(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	product, err := s.productRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товар: %w", err)
	}
	return product, nil
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
	if !hasOrder {
		return false, nil
	}
	alreadyReviewed, err := s.reviewRepo.HasUserReviewed(ctx, storeID, userID)
	if err != nil {
		return false, fmt.Errorf("не удалось проверить отзывы: %w", err)
	}
	return !alreadyReviewed, nil
}

// UpdateProduct обновляет поля товара (только для ADMIN).
func (s *CatalogService) UpdateProduct(ctx context.Context, id uuid.UUID, name string, price float64, description *string, isAvailable bool) (*models.Product, error) {
	product, err := s.productRepo.Update(ctx, id, name, price, description, isAvailable)
	if err != nil {
		return nil, fmt.Errorf("не удалось обновить товар: %w", err)
	}
	return product, nil
}

// UpdateStore обновляет поля магазина (только для ADMIN).
func (s *CatalogService) UpdateStore(ctx context.Context, id uuid.UUID, name string, address string, description *string, opensAt *string, closesAt *string) (*models.Store, error) {
	store, err := s.storeRepo.Update(ctx, id, name, address, description, opensAt, closesAt)
	if err != nil {
		return nil, fmt.Errorf("не удалось обновить магазин: %w", err)
	}
	return store, nil
}

// DeleteReview удаляет отзыв (только для ADMIN).
func (s *CatalogService) DeleteReview(ctx context.Context, reviewID uuid.UUID) error {
	if err := s.reviewRepo.Delete(ctx, reviewID); err != nil {
		return fmt.Errorf("не удалось удалить отзыв: %w", err)
	}
	return nil
}

// CreateReview создаёт отзыв, предварительно проверяя право пользователя.
func (s *CatalogService) CreateReview(ctx context.Context, storeID uuid.UUID, userID uuid.UUID, rating int, comment string) (*models.Review, error) {
	canReview, err := s.CanUserReview(ctx, storeID, userID)
	if err != nil {
		return nil, err
	}
	if !canReview {
		// Уточняем причину для ответа 403
		hasOrder, _ := s.reviewRepo.HasDeliveredOrder(ctx, storeID, userID)
		if !hasOrder {
			return nil, fmt.Errorf("нет заказа из этого магазина")
		}
		return nil, fmt.Errorf("отзыв уже оставлен")
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
	return s.featuredRepo.GetByBlock(ctx, blockType)
}
