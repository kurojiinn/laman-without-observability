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
	argPos := 1

	if categoryID != nil {
		query += fmt.Sprintf(" AND category_id = $%d", argPos)
		args = append(args, *categoryID)
		argPos++
	}

	if subcategoryID != nil {
		query += fmt.Sprintf(" AND subcategory_id = $%d", argPos)
		args = append(args, *subcategoryID)
		argPos++
	}

	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR COALESCE(description, '') ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+*search+"%")
		argPos++
	}

	if availableOnly {
		query += fmt.Sprintf(" AND is_available = $%d", argPos)
		args = append(args, true)
		argPos++
	}

	query += " ORDER BY name"

	err := r.db.SelectContext(ctx, &products, query, args...)
	return products, err
}

func (r *postgresProductRepository) GetByStoreID(ctx context.Context, storeID uuid.UUID, subcategoryID *uuid.UUID, search *string, availableOnly bool) ([]models.Product, error) {
	var products []models.Product
	query := `SELECT id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at FROM products WHERE store_id = $1`
	args := []interface{}{storeID}
	argPos := 2

	if subcategoryID != nil {
		query += fmt.Sprintf(" AND subcategory_id = $%d", argPos)
		args = append(args, *subcategoryID)
		argPos++
	}

	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR COALESCE(description, '') ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+*search+"%")
		argPos++
	}

	if availableOnly {
		query += fmt.Sprintf(" AND is_available = $%d", argPos)
		args = append(args, true)
		argPos++
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
	query := `SELECT id, name, address, phone, description, image_url, rating, category_type, created_at, updated_at, lat, lng FROM stores WHERE 1=1`
	args := []interface{}{}
	argPos := 1

	if categoryType != nil {
		query += fmt.Sprintf(" AND category_type = $%d", argPos)
		args = append(args, *categoryType)
		argPos++
	}

	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argPos, argPos)
		args = append(args, "%"+*search+"%")
		argPos++
	}

	query += " ORDER BY name"

	err := r.db.SelectContext(ctx, &stores, query, args...)
	return stores, err
}

func (r *postgresStoreRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Store, error) {
	var store models.Store
	query := `SELECT id, name, address, phone, description, image_url, rating, category_type, created_at, updated_at, lat, lng FROM stores WHERE id = $1`
	err := r.db.GetContext(ctx, &store, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("магазин не найден")
	}
	if err != nil {
		return nil, err
	}
	return &store, nil
}
