package catalog

import (
	"Laman/internal/models"
	"context"
	"github.com/google/uuid"
)

// CategoryRepository определяет интерфейс для доступа к данным категорий.
type CategoryRepository interface {
	// GetAll получает все категории.
	GetAll(ctx context.Context) ([]models.Category, error)

	// GetByID получает категорию по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error)
}

// SubcategoryRepository определяет интерфейс для доступа к подкатегориям.
type SubcategoryRepository interface {
	// GetByCategoryID получает подкатегории по ID категории.
	GetByCategoryID(ctx context.Context, categoryID uuid.UUID) ([]models.Subcategory, error)

	// GetByStoreID получает подкатегории товаров конкретного магазина.
	GetByStoreID(ctx context.Context, storeID uuid.UUID) ([]models.Subcategory, error)
}

// ProductRepository определяет интерфейс для доступа к данным товаров.
type ProductRepository interface {
	// GetAll получает все товары с опциональными фильтрами.
	GetAll(ctx context.Context, categoryID *uuid.UUID, subcategoryID *uuid.UUID, search *string, availableOnly bool) ([]models.Product, error)

	// GetByStoreID получает товары конкретного магазина с фильтрами.
	GetByStoreID(ctx context.Context, storeID uuid.UUID, subcategoryID *uuid.UUID, search *string, availableOnly bool) ([]models.Product, error)

	// GetByID получает товар по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error)

	// GetByIDs получает несколько товаров по их ID.
	GetByIDs(ctx context.Context, ids []uuid.UUID) ([]models.Product, error)
}

// StoreRepository определяет интерфейс для доступа к данным магазинов.
type StoreRepository interface {
	// GetAll получает все магазины.
	GetAll(ctx context.Context, categoryType *models.StoreCategoryType, search *string) ([]models.Store, error)

	// GetByID получает магазин по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Store, error)
}
