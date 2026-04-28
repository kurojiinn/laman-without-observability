package catalog

import (
	"Laman/internal/database"
	"Laman/internal/models"
	"context"
	"database/sql"
	"fmt"
	"time"

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
	query := `SELECT id, name, description, image_url, created_at, updated_at FROM categories ORDER BY name`
	err := r.db.SelectContext(ctx, &categories, query)
	return categories, err
}

func (r *postgresCategoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	var category models.Category
	query := `SELECT id, name, description, image_url, created_at, updated_at FROM categories WHERE id = $1`
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

func (r *postgresProductRepository) GetByStoreID(ctx context.Context, storeID uuid.UUID, subcategoryID *uuid.UUID, search *string, availableOnly bool, sort string, limit, offset int) ([]models.Product, error) {
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

	switch sort {
	case "price_asc":
		query += " ORDER BY price ASC"
	case "price_desc":
		query += " ORDER BY price DESC"
	case "newest":
		query += " ORDER BY created_at DESC"
	default:
		query += " ORDER BY name"
	}

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(args)+1, len(args)+2)
		args = append(args, limit, offset)
	}

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
	if err := r.db.QueryRowContext(ctx, query, review.StoreID, review.UserID, review.Rating, review.Comment).
		Scan(&review.ID, &review.CreatedAt); err != nil {
		return err
	}
	return r.db.QueryRowContext(ctx, `SELECT phone FROM users WHERE id = $1`, review.UserID).
		Scan(&review.UserPhone)
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

func (r *postgresReviewRepository) DeleteByOwner(ctx context.Context, reviewID uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM reviews WHERE id = $1 AND user_id = $2`
	res, err := r.db.ExecContext(ctx, query, reviewID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("отзыв не найден или не принадлежит пользователю")
	}
	return nil
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

// postgresRecipeRepository реализует RecipeRepository.
type postgresRecipeRepository struct {
	db *database.DB
}

// NewPostgresRecipeRepository создаёт репозиторий рецептов.
func NewPostgresRecipeRepository(db *database.DB) RecipeRepository {
	return &postgresRecipeRepository{db: db}
}

func (r *postgresRecipeRepository) GetAll(ctx context.Context) ([]models.RecipeWithProducts, error) {
	type row struct {
		models.Recipe
		ProductID       *uuid.UUID `db:"product_id"`
		ProductCategory *uuid.UUID `db:"product_category_id"`
		ProductSubcat   *uuid.UUID `db:"product_subcategory_id"`
		ProductStoreID  *uuid.UUID `db:"product_store_id"`
		ProductName     *string    `db:"product_name"`
		ProductDesc     *string    `db:"product_description"`
		ProductImageURL *string    `db:"product_image_url"`
		ProductPrice    *float64   `db:"product_price"`
		ProductWeight   *float64   `db:"product_weight"`
		ProductAvail    *bool      `db:"product_is_available"`
		ProductCreated  *time.Time `db:"product_created_at"`
		ProductUpdated  *time.Time `db:"product_updated_at"`
		Quantity        *int       `db:"quantity"`
	}
	var rows []row
	err := r.db.SelectContext(ctx, &rows, `
		SELECT
			rec.id, rec.store_id, rec.name, rec.description, rec.image_url, rec.position, rec.created_at, rec.updated_at,
			p.id          AS product_id,
			p.category_id AS product_category_id,
			p.subcategory_id AS product_subcategory_id,
			p.store_id    AS product_store_id,
			p.name        AS product_name,
			p.description AS product_description,
			p.image_url   AS product_image_url,
			p.price       AS product_price,
			p.weight      AS product_weight,
			p.is_available AS product_is_available,
			p.created_at  AS product_created_at,
			p.updated_at  AS product_updated_at,
			rp.quantity
		FROM recipes rec
		LEFT JOIN recipe_products rp ON rp.recipe_id = rec.id
		LEFT JOIN products p ON p.id = rp.product_id
		ORDER BY rec.position ASC, rec.created_at DESC, p.name ASC
	`)
	if err != nil {
		return nil, err
	}

	index := make(map[uuid.UUID]*models.RecipeWithProducts)
	order := make([]uuid.UUID, 0)
	for _, r := range rows {
		if _, ok := index[r.Recipe.ID]; !ok {
			rcp := &models.RecipeWithProducts{Recipe: r.Recipe, Products: []models.RecipeIngredient{}}
			index[r.Recipe.ID] = rcp
			order = append(order, r.Recipe.ID)
		}
		if r.ProductID != nil {
			index[r.Recipe.ID].Products = append(index[r.Recipe.ID].Products, models.RecipeIngredient{
				Product: models.Product{
					ID:            *r.ProductID,
					CategoryID:    func() uuid.UUID { if r.ProductCategory != nil { return *r.ProductCategory }; return uuid.UUID{} }(),
					SubcategoryID: r.ProductSubcat,
					StoreID:       *r.ProductStoreID,
					Name:          *r.ProductName,
					Description:   r.ProductDesc,
					ImageURL:      r.ProductImageURL,
					Price:         *r.ProductPrice,
					Weight:        r.ProductWeight,
					IsAvailable:   *r.ProductAvail,
					CreatedAt:     *r.ProductCreated,
					UpdatedAt:     *r.ProductUpdated,
				},
				Quantity: *r.Quantity,
			})
		}
	}

	result := make([]models.RecipeWithProducts, 0, len(order))
	for _, id := range order {
		result = append(result, *index[id])
	}
	return result, nil
}

func (r *postgresRecipeRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.RecipeWithProducts, error) {
	var recipe models.Recipe
	err := r.db.GetContext(ctx, &recipe, `SELECT id, store_id, name, description, image_url, position, created_at, updated_at FROM recipes WHERE id = $1`, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("рецепт не найден")
	}
	if err != nil {
		return nil, err
	}

	type row struct {
		models.Product
		Quantity int `db:"quantity"`
	}
	var rows []row
	err = r.db.SelectContext(ctx, &rows, `
		SELECT p.id, p.category_id, p.subcategory_id, p.store_id, p.name, p.description,
		       p.image_url, p.price, p.weight, p.is_available, p.created_at, p.updated_at,
		       rp.quantity
		FROM recipe_products rp
		JOIN products p ON p.id = rp.product_id
		WHERE rp.recipe_id = $1
		ORDER BY p.name
	`, id)
	if err != nil {
		return nil, err
	}

	ingredients := make([]models.RecipeIngredient, 0, len(rows))
	for _, row := range rows {
		ingredients = append(ingredients, models.RecipeIngredient{Product: row.Product, Quantity: row.Quantity})
	}

	return &models.RecipeWithProducts{Recipe: recipe, Products: ingredients}, nil
}

func (r *postgresRecipeRepository) Create(ctx context.Context, recipe *models.Recipe) error {
	return r.db.QueryRowContext(ctx,
		`INSERT INTO recipes (store_id, name, description, image_url, position) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`,
		recipe.StoreID, recipe.Name, recipe.Description, recipe.ImageURL, recipe.Position,
	).Scan(&recipe.ID, &recipe.CreatedAt, &recipe.UpdatedAt)
}

func (r *postgresRecipeRepository) Update(ctx context.Context, id uuid.UUID, name string, description *string, imageURL *string, position int) (*models.Recipe, error) {
	var recipe models.Recipe
	err := r.db.GetContext(ctx, &recipe,
		`UPDATE recipes SET name=$1, description=$2, image_url=$3, position=$4, updated_at=NOW() WHERE id=$5 RETURNING id, name, description, image_url, position, created_at, updated_at`,
		name, description, imageURL, position, id,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("рецепт не найден")
	}
	return &recipe, err
}

func (r *postgresRecipeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM recipes WHERE id = $1`, id)
	return err
}

func (r *postgresRecipeRepository) AddProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID, quantity int) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO recipe_products (recipe_id, product_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (recipe_id, product_id) DO UPDATE SET quantity = $3`,
		recipeID, productID, quantity,
	)
	return err
}

func (r *postgresRecipeRepository) RemoveProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM recipe_products WHERE recipe_id = $1 AND product_id = $2`, recipeID, productID)
	return err
}

// ─── PostgresScenarioRepository ───────────────────────────────────────────────

type postgresScenarioRepository struct{ db *database.DB }

func NewPostgresScenarioRepository(db *database.DB) ScenarioRepository {
	return &postgresScenarioRepository{db: db}
}

func (r *postgresScenarioRepository) GetActive(ctx context.Context) ([]models.Scenario, error) {
	var rows []models.Scenario
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id, label, subtitle, section_key, image_url, emoji, position, is_active, created_at, updated_at
		 FROM featured_scenarios WHERE is_active = true ORDER BY position ASC`)
	return rows, err
}

func (r *postgresScenarioRepository) GetAll(ctx context.Context) ([]models.Scenario, error) {
	var rows []models.Scenario
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id, label, subtitle, section_key, image_url, emoji, position, is_active, created_at, updated_at
		 FROM featured_scenarios ORDER BY position ASC`)
	return rows, err
}

func (r *postgresScenarioRepository) Create(ctx context.Context, s models.Scenario) (*models.Scenario, error) {
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO featured_scenarios (label, subtitle, section_key, image_url, emoji, position, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, created_at, updated_at`,
		s.Label, s.Subtitle, s.SectionKey, s.ImageURL, s.Emoji, s.Position, s.IsActive,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
	return &s, err
}

func (r *postgresScenarioRepository) Update(ctx context.Context, id uuid.UUID, s models.Scenario) (*models.Scenario, error) {
	s.ID = id
	err := r.db.QueryRowContext(ctx,
		`UPDATE featured_scenarios SET label=$1, subtitle=$2, section_key=$3, image_url=$4, emoji=$5, position=$6, is_active=$7, updated_at=NOW()
		 WHERE id=$8 RETURNING updated_at`,
		s.Label, s.Subtitle, s.SectionKey, s.ImageURL, s.Emoji, s.Position, s.IsActive, id,
	).Scan(&s.UpdatedAt)
	return &s, err
}

func (r *postgresScenarioRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM featured_scenarios WHERE id = $1`, id)
	return err
}

// ─── PostgresStoreCategoryMetaRepository ─────────────────────────────────────

type postgresStoreCategoryMetaRepository struct{ db *database.DB }

func NewPostgresStoreCategoryMetaRepository(db *database.DB) StoreCategoryMetaRepository {
	return &postgresStoreCategoryMetaRepository{db: db}
}

func (r *postgresStoreCategoryMetaRepository) GetAll(ctx context.Context) ([]models.StoreCategoryMeta, error) {
	var rows []models.StoreCategoryMeta
	err := r.db.SelectContext(ctx, &rows, `SELECT category_type, name, description, image_url FROM store_category_meta ORDER BY category_type`)
	return rows, err
}

func (r *postgresStoreCategoryMetaRepository) UpdateImage(ctx context.Context, categoryType string, imageURL string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE store_category_meta SET image_url = $1, updated_at = NOW() WHERE category_type = $2`,
		imageURL, categoryType,
	)
	return err
}

func (r *postgresStoreCategoryMetaRepository) UpdateMeta(ctx context.Context, categoryType string, name, description string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE store_category_meta SET name = $1, description = $2, updated_at = NOW() WHERE category_type = $3`,
		name, description, categoryType,
	)
	return err
}
