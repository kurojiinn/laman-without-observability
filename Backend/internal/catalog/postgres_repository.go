package catalog

import (
	"Laman/internal/database"
	"Laman/internal/models"
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// postgresCategoryRepository реализует CategoryRepository используя PostgreSQL.
type postgresCategoryRepository struct {
	db *database.DB
}

// NewPostgresCategoryRepository создает новый PostgreSQL репозиторий категорий.
func NewPostgresCategoryRepository(db *database.DB) CategoryRepository {
	return &postgresCategoryRepository{db: db}
}

func (r *postgresCategoryRepository) GetAll(ctx context.Context) ([]models.Category, error) {
	var categories []models.Category
	query := `SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name`
	err := r.db.SelectContext(ctx, &categories, query)
	return categories, err
}

func (r *postgresCategoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	var category models.Category
	query := `SELECT id, name, description, created_at, updated_at FROM categories WHERE id = $1`
	err := r.db.GetContext(ctx, &category, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("категория не найдена")
	}
	if err != nil {
		return nil, err
	}
	return &category, nil
}

// postgresSubcategoryRepository реализует SubcategoryRepository используя PostgreSQL.
type postgresSubcategoryRepository struct {
	db *database.DB
}

// NewPostgresSubcategoryRepository создает новый PostgreSQL репозиторий подкатегорий.
func NewPostgresSubcategoryRepository(db *database.DB) SubcategoryRepository {
	return &postgresSubcategoryRepository{db: db}
}

func (r *postgresSubcategoryRepository) GetByCategoryID(ctx context.Context, categoryID uuid.UUID) ([]models.Subcategory, error) {
	var subcategories []models.Subcategory
	query := `SELECT id, category_id, name, created_at, updated_at FROM subcategories WHERE category_id = $1 ORDER BY name`
	err := r.db.SelectContext(ctx, &subcategories, query, categoryID)
	return subcategories, err
}

func (r *postgresSubcategoryRepository) GetByStoreID(ctx context.Context, storeID uuid.UUID) ([]models.Subcategory, error) {
	var subcategories []models.Subcategory
	query := `
SELECT DISTINCT s.id, s.category_id, s.name, s.created_at, s.updated_at
FROM subcategories s
JOIN products p ON p.subcategory_id = s.id
WHERE p.store_id = $1
ORDER BY s.name
`
	err := r.db.SelectContext(ctx, &subcategories, query, storeID)
	return subcategories, err
}

// postgresProductRepository реализует ProductRepository используя PostgreSQL.
type postgresProductRepository struct {
	db *database.DB
}

// NewPostgresProductRepository создает новый PostgreSQL репозиторий товаров.
func NewPostgresProductRepository(db *database.DB) ProductRepository {
	return &postgresProductRepository{db: db}
}

func (r *postgresProductRepository) GetAll(ctx context.Context, categoryID *uuid.UUID, subcategoryID *uuid.UUID, search *string, availableOnly bool) ([]models.Product, error) {
	var products []models.Product
	query := `SELECT id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at FROM products WHERE 1=1`
	args := []interface{}{}

	if categoryID != nil {
		query += fmt.Sprintf(" AND category_id = $%d", len(args)+1)
		args = append(args, *categoryID)
	}

	if subcategoryID != nil {
		query += fmt.Sprintf(" AND subcategory_id = $%d", len(args)+1)
		args = append(args, *subcategoryID)
	}

	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR COALESCE(description, '') ILIKE $%d)", len(args)+1, len(args)+1)
		args = append(args, "%"+*search+"%")
	}

	if availableOnly {
		query += fmt.Sprintf(" AND is_available = $%d", len(args)+1)
		args = append(args, true)
	}

	query += " ORDER BY name"

	err := r.db.SelectContext(ctx, &products, query, args...)
	return products, err
}

func (r *postgresProductRepository) GetByStoreID(ctx context.Context, storeID uuid.UUID, subcategoryID *uuid.UUID, search *string, availableOnly bool) ([]models.Product, error) {
	var products []models.Product
	query := `SELECT id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at FROM products WHERE store_id = $1`
	args := []interface{}{storeID}

	if subcategoryID != nil {
		query += fmt.Sprintf(" AND subcategory_id = $%d", len(args)+1)
		args = append(args, *subcategoryID)
	}

	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR COALESCE(description, '') ILIKE $%d)", len(args)+1, len(args)+1)
		args = append(args, "%"+*search+"%")
	}

	if availableOnly {
		query += fmt.Sprintf(" AND is_available = $%d", len(args)+1)
		args = append(args, true)
	}

	query += " ORDER BY name"

	err := r.db.SelectContext(ctx, &products, query, args...)
	return products, err
}

func (r *postgresProductRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	var product models.Product
	query := `SELECT id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at FROM products WHERE id = $1`
	err := r.db.GetContext(ctx, &product, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("товар не найден")
	}
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *postgresProductRepository) GetByIDs(ctx context.Context, ids []uuid.UUID) ([]models.Product, error) {
	if len(ids) == 0 {
		return []models.Product{}, nil
	}

	var products []models.Product
	query, args, err := sqlx.In(`SELECT id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at FROM products WHERE id IN (?)`, ids)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	err = r.db.SelectContext(ctx, &products, query, args...)
	return products, err
}

func (r *postgresProductRepository) Update(ctx context.Context, id uuid.UUID, name string, price float64, description *string, isAvailable bool) (*models.Product, error) {
	query := `
UPDATE products
SET name=$1, price=$2, description=$3, is_available=$4, updated_at=NOW()
WHERE id=$5
RETURNING id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at`
	var product models.Product
	err := r.db.GetContext(ctx, &product, query, name, price, description, isAvailable, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("товар не найден")
	}
	if err != nil {
		return nil, err
	}
	return &product, nil
}

// postgresStoreRepository реализует StoreRepository используя PostgreSQL.
type postgresStoreRepository struct {
	db *database.DB
}

// NewPostgresStoreRepository создает новый PostgreSQL репозиторий магазинов.
func NewPostgresStoreRepository(db *database.DB) StoreRepository {
	return &postgresStoreRepository{db: db}
}

func (r *postgresStoreRepository) GetAll(ctx context.Context, categoryType *models.StoreCategoryType, search *string) ([]models.Store, error) {
	var stores []models.Store
	query := `SELECT id, name, address, city, phone, description, image_url, rating, category_type, opens_at, closes_at, created_at, updated_at, lat, lng FROM stores WHERE 1=1`
	args := []interface{}{}

	if categoryType != nil {
		query += fmt.Sprintf(" AND category_type = $%d", len(args)+1)
		args = append(args, *categoryType)
	}

	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", len(args)+1, len(args)+1)
		args = append(args, "%"+*search+"%")
	}

	query += " ORDER BY name"

	err := r.db.SelectContext(ctx, &stores, query, args...)
	return stores, err
}

func (r *postgresStoreRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Store, error) {
	var store models.Store
	query := `SELECT id, name, address, city, phone, description, image_url, rating, category_type, opens_at, closes_at, created_at, updated_at, lat, lng FROM stores WHERE id = $1`
	err := r.db.GetContext(ctx, &store, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("магазин не найден")
	}
	if err != nil {
		return nil, err
	}
	return &store, nil
}

func (r *postgresStoreRepository) Update(ctx context.Context, id uuid.UUID, name string, address string, description *string, opensAt *string, closesAt *string) (*models.Store, error) {
	query := `
UPDATE stores
SET name=$1, address=$2, description=$3, opens_at=$4, closes_at=$5, updated_at=NOW()
WHERE id=$6
RETURNING id, name, address, city, phone, description, image_url, rating, category_type, opens_at, closes_at, created_at, updated_at, lat, lng`
	var store models.Store
	err := r.db.GetContext(ctx, &store, query, name, address, description, opensAt, closesAt, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("магазин не найден")
	}
	if err != nil {
		return nil, err
	}
	return &store, nil
}

// postgresReviewRepository реализует ReviewRepository используя PostgreSQL.
type postgresReviewRepository struct {
	db *database.DB
}

// NewPostgresReviewRepository создает новый PostgreSQL репозиторий отзывов.
func NewPostgresReviewRepository(db *database.DB) ReviewRepository {
	return &postgresReviewRepository{db: db}
}

func (r *postgresReviewRepository) GetByStoreID(ctx context.Context, storeID uuid.UUID) ([]models.Review, error) {
	var reviews []models.Review
	query := `
SELECT rv.id, rv.store_id, rv.user_id, u.phone AS user_phone, rv.rating, rv.comment, rv.created_at
FROM reviews rv
JOIN users u ON u.id = rv.user_id
WHERE rv.store_id = $1
ORDER BY rv.created_at DESC`
	err := r.db.SelectContext(ctx, &reviews, query, storeID)
	if err != nil {
		return nil, err
	}
	if reviews == nil {
		reviews = []models.Review{}
	}
	return reviews, nil
}

func (r *postgresReviewRepository) Create(ctx context.Context, review *models.Review) error {
	query := `
INSERT INTO reviews (store_id, user_id, rating, comment)
VALUES ($1, $2, $3, $4)
RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query, review.StoreID, review.UserID, review.Rating, review.Comment).
		Scan(&review.ID, &review.CreatedAt)
}

func (r *postgresReviewRepository) HasUserReviewed(ctx context.Context, storeID uuid.UUID, userID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM reviews WHERE store_id = $1 AND user_id = $2)`
	err := r.db.QueryRowContext(ctx, query, storeID, userID).Scan(&exists)
	return exists, err
}

func (r *postgresReviewRepository) HasDeliveredOrder(ctx context.Context, storeID uuid.UUID, userID uuid.UUID) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM orders WHERE store_id = $1 AND user_id = $2 AND status != 'CANCELLED')`
	err := r.db.QueryRowContext(ctx, query, storeID, userID).Scan(&exists)
	return exists, err
}

func (r *postgresReviewRepository) Delete(ctx context.Context, reviewID uuid.UUID) error {
	query := `DELETE FROM reviews WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, reviewID)
	return err
}

// postgresFeaturedProductRepository реализует FeaturedProductRepository.
type postgresFeaturedProductRepository struct {
	db *database.DB
}

// NewPostgresFeaturedProductRepository создаёт репозиторий блоков витрины.
func NewPostgresFeaturedProductRepository(db *database.DB) FeaturedProductRepository {
	return &postgresFeaturedProductRepository{db: db}
}

func (r *postgresFeaturedProductRepository) GetByBlock(ctx context.Context, blockType models.FeaturedBlockType) ([]models.Product, error) {
	var products []models.Product
	query := `
		SELECT p.id, p.category_id, p.subcategory_id, p.store_id, p.name, p.description,
		       p.image_url, p.price, p.weight, p.is_available, p.created_at, p.updated_at
		FROM products p
		JOIN featured_products fp ON fp.product_id = p.id
		WHERE fp.block_type = $1 AND p.is_available = TRUE
		ORDER BY fp.position ASC
	`
	err := r.db.SelectContext(ctx, &products, query, blockType)
	return products, err
}
