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
}

// NewCatalogService создает новый сервис каталога.
func NewCatalogService(
	categoryRepo CategoryRepository,
	subcategoryRepo SubcategoryRepository,
	productRepo ProductRepository,
	storeRepo StoreRepository,
) *CatalogService {
	return &CatalogService{
		categoryRepo:    categoryRepo,
		subcategoryRepo: subcategoryRepo,
		productRepo:     productRepo,
		storeRepo:       storeRepo,
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
