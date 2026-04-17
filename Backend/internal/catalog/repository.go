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

	// Update обновляет поля товара.
	Update(ctx context.Context, id uuid.UUID, name string, price float64, description *string, isAvailable bool) (*models.Product, error)
}

// FeaturedProductRepository определяет доступ к блокам витрины.
type FeaturedProductRepository interface {
	// GetByBlock возвращает товары блока, отсортированные по position.
	GetByBlock(ctx context.Context, blockType models.FeaturedBlockType) ([]models.Product, error)
}

// StoreRepository определяет интерфейс для доступа к данным магазинов.
type StoreRepository interface {
	// GetAll получает все магазины.
	GetAll(ctx context.Context, categoryType *models.StoreCategoryType, search *string) ([]models.Store, error)

	// GetByID получает магазин по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.Store, error)

	// Update обновляет поля магазина.
	Update(ctx context.Context, id uuid.UUID, name string, address string, description *string, opensAt *string, closesAt *string) (*models.Store, error)
}

// RecipeRepository определяет интерфейс для работы с рецептами.
type RecipeRepository interface {
	GetAll(ctx context.Context) ([]models.RecipeWithProducts, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.RecipeWithProducts, error)
	Create(ctx context.Context, recipe *models.Recipe) error
	Update(ctx context.Context, id uuid.UUID, name string, description *string, imageURL *string, position int) (*models.Recipe, error)
	Delete(ctx context.Context, id uuid.UUID) error
	AddProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID, quantity int) error
	RemoveProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID) error
}

// ReviewRepository определяет интерфейс для работы с отзывами.
type ReviewRepository interface {
	// GetByStoreID возвращает все отзывы для магазина (с телефоном пользователя).
	GetByStoreID(ctx context.Context, storeID uuid.UUID) ([]models.Review, error)

	// Create сохраняет новый отзыв.
	Create(ctx context.Context, review *models.Review) error

	// HasUserReviewed проверяет, оставлял ли пользователь отзыв на этот магазин.
	HasUserReviewed(ctx context.Context, storeID uuid.UUID, userID uuid.UUID) (bool, error)

	// HasDeliveredOrder проверяет, есть ли у пользователя доставленный заказ из этого магазина.
	HasDeliveredOrder(ctx context.Context, storeID uuid.UUID, userID uuid.UUID) (bool, error)

	// Delete удаляет отзыв по ID.
	Delete(ctx context.Context, reviewID uuid.UUID) error

	// DeleteByOwner удаляет отзыв только если он принадлежит пользователю.
	DeleteByOwner(ctx context.Context, reviewID uuid.UUID, userID uuid.UUID) error
}
