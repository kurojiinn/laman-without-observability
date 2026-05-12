package admin

import (
	"context"
	"fmt"
	"strings"
	"time"

	"Laman/internal/database"
	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository определяет доступ к данным для admin-операций.
type Repository interface {
	GetDashboardStats(ctx context.Context) (*DashboardStats, error)
	GetAllOrders(ctx context.Context) ([]models.Order, error)
	CreateStore(ctx context.Context, store *models.Store) error
	ListStores(ctx context.Context) ([]models.Store, error)
	UpdateStore(ctx context.Context, id uuid.UUID, name, address, city, description string, categoryType models.StoreCategoryType) error
	UpdateStoreImage(ctx context.Context, id uuid.UUID, imageURL string) error
	DeleteStore(ctx context.Context, id uuid.UUID) error
	ArchiveStore(ctx context.Context, id uuid.UUID) error
	RestoreStore(ctx context.Context, id uuid.UUID) error
	StoreHasDependencies(ctx context.Context, id uuid.UUID) (orders int, pickers int, err error)
	// Магазин-локальные подкатегории
	GetStoreSubcategories(ctx context.Context, storeID uuid.UUID) ([]models.Subcategory, error)
	CreateStoreSubcategory(ctx context.Context, storeID uuid.UUID, name string) (*models.Subcategory, error)
	DeleteStoreSubcategory(ctx context.Context, storeID, subID uuid.UUID) error
	CountProductsInSubcategory(ctx context.Context, subID uuid.UUID) (int, error)
	CreateProduct(ctx context.Context, product *models.Product) error
	DeleteProduct(ctx context.Context, id uuid.UUID) error
	UpdateProduct(ctx context.Context, id uuid.UUID, req *UpdateProductRequest) (*models.Product, error)
	GetProductsByStore(ctx context.Context, storeID uuid.UUID) ([]models.Product, error)
	UpdateOrderStatus(ctx context.Context, id uuid.UUID, status models.OrderStatus) error
	GetOrderUserID(ctx context.Context, id uuid.UUID) (*uuid.UUID, error)
	GetCategoryAndStoreMaps(ctx context.Context) (map[string]uuid.UUID, map[string]uuid.UUID, error)
	BulkInsertProducts(ctx context.Context, rows []ImportProductRow) error
	// Витрина: управление блоками на главном экране
	GetFeaturedList(ctx context.Context, blockType models.FeaturedBlockType) ([]models.FeaturedProduct, error)
	AddFeatured(ctx context.Context, fp *models.FeaturedProduct) error
	DeleteFeatured(ctx context.Context, id uuid.UUID) error
	// Категории
	GetCategories(ctx context.Context) ([]models.Category, error)
	CreateCategory(ctx context.Context, cat *models.Category) error
	UpdateCategoryImage(ctx context.Context, id uuid.UUID, imageURL string) error
	UpdateCategoryName(ctx context.Context, id uuid.UUID, name string) error
	DeleteCategory(ctx context.Context, id uuid.UUID) error
	// Сборщики
	CreatePicker(ctx context.Context, user *models.User) error
	GetPickers(ctx context.Context) ([]PickerInfo, error)
	DeletePicker(ctx context.Context, id uuid.UUID) error
	UpdatePickerStore(ctx context.Context, id uuid.UUID, storeID uuid.UUID) error
	UpdatePickerPassword(ctx context.Context, id uuid.UUID, passwordHash string) error
	IsPhoneTaken(ctx context.Context, phone string) (bool, error)
}

// PickerInfo описывает сборщика с информацией о его магазине для админки.
type PickerInfo struct {
	ID        uuid.UUID `db:"id" json:"id"`
	Phone     string    `db:"phone" json:"phone"`
	StoreID   uuid.UUID `db:"store_id" json:"store_id"`
	StoreName string    `db:"store_name" json:"store_name"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

// postgresRepository реализует Repository на PostgreSQL.
type postgresRepository struct {
	db *database.DB
}

// NewPostgresRepository создает репозиторий admin-операций.
func NewPostgresRepository(db *database.DB) Repository {
	return &postgresRepository{db: db}
}

// GetDashboardStats возвращает агрегированную статистику.
func (r *postgresRepository) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	if err := r.db.GetContext(ctx, &stats.TotalRegisteredUsers, `SELECT COUNT(*) FROM users`); err != nil {
		return nil, err
	}

	if err := r.db.GetContext(ctx, &stats.TotalGuests, `SELECT COUNT(*) FROM orders WHERE user_id IS NULL`); err != nil {
		return nil, err
	}

	if err := r.db.GetContext(ctx, &stats.ActiveOrdersCount, `
		SELECT COUNT(*)
		FROM orders
		WHERE status NOT IN ('DELIVERED', 'CANCELLED')
	`); err != nil {
		return nil, err
	}

	if err := r.db.GetContext(ctx, &stats.TodayRevenue, `
		SELECT COALESCE(SUM(final_total), 0)
		FROM orders
		WHERE created_at >= date_trunc('day', now())
		  AND created_at < date_trunc('day', now()) + interval '1 day'
		  AND status <> 'CANCELLED'
	`); err != nil {
		return nil, err
	}

	return stats, nil
}

// GetAllOrders возвращает все заказы за последние 90 дней.
func (r *postgresRepository) GetAllOrders(ctx context.Context) ([]models.Order, error) {
	var orders []models.Order
	query := `
		SELECT id, user_id, customer_phone, comment, status, store_id, payment_method,
		       items_total, service_fee, delivery_fee, final_total,
		       delivery_type, scheduled_at, delivery_surcharge, created_at, updated_at
		FROM orders
		WHERE created_at >= NOW() - INTERVAL '90 days'
		ORDER BY created_at DESC
	`
	err := r.db.SelectContext(ctx, &orders, query)
	return orders, err
}

// ListStores возвращает все магазины, включая архивные (is_active=false).
// Для admin-панели.
func (r *postgresRepository) ListStores(ctx context.Context) ([]models.Store, error) {
	var stores []models.Store
	query := `SELECT id, name, address, city, phone, description, image_url, rating, category_type,
	                 opens_at, closes_at, is_active, created_at, updated_at, lat, lng
	          FROM stores
	          ORDER BY is_active DESC, name`
	err := r.db.SelectContext(ctx, &stores, query)
	return stores, err
}

// CreateStore сохраняет новый магазин.
func (r *postgresRepository) CreateStore(ctx context.Context, store *models.Store) error {
	query := `
		INSERT INTO stores (id, name, address, city, phone, description, image_url, rating, category_type, opens_at, closes_at, created_at, updated_at, lat, lng)
		VALUES (:id, :name, :address, :city, :phone, :description, :image_url, :rating, :category_type, :opens_at, :closes_at, :created_at, :updated_at, :lat, :lng)
		`
	_, err := r.db.NamedExecContext(ctx, query, store)
	return err
}

// UpdateStore обновляет поля магазина.
func (r *postgresRepository) UpdateStore(ctx context.Context, id uuid.UUID, name, address, city, description string, categoryType models.StoreCategoryType) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE stores SET name=$1, address=$2, city=$3, description=$4, category_type=$5, updated_at=NOW() WHERE id=$6`,
		name, address, city, description, categoryType, id,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("магазин не найден")
	}
	return nil
}

// UpdateStoreImage обновляет фото магазина.
func (r *postgresRepository) UpdateStoreImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE stores SET image_url = $1, updated_at = NOW() WHERE id = $2`,
		imageURL, id,
	)
	return err
}

// DeleteStore удаляет магазин и его товары в транзакции.
// Падает при наличии зависимостей (orders.store_id, order_items.product_id, users.store_id с FK).
// Для архивации с историей использовать ArchiveStore.
func (r *postgresRepository) DeleteStore(ctx context.Context, id uuid.UUID) error {
	return r.db.WithTx(ctx, func(tx *sqlx.Tx) error {
		if _, err := tx.ExecContext(ctx, `DELETE FROM products WHERE store_id = $1`, id); err != nil {
			return err
		}

		res, err := tx.ExecContext(ctx, `DELETE FROM stores WHERE id = $1`, id)
		if err != nil {
			return err
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return fmt.Errorf("магазин не найден")
		}
		return nil
	})
}

// ArchiveStore помечает магазин как неактивный (soft delete).
// История заказов и привязки picker'ов сохраняются.
func (r *postgresRepository) ArchiveStore(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE stores SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
		id,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("магазин не найден")
	}
	return nil
}

// RestoreStore возвращает магазин в активное состояние.
func (r *postgresRepository) RestoreStore(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE stores SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
		id,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("магазин не найден")
	}
	return nil
}

// GetStoreSubcategories возвращает только подкатегории, привязанные к этому магазину (store_id = $1).
// Глобальные (store_id IS NULL) не возвращает — они управляются через CategoriesPage.
func (r *postgresRepository) GetStoreSubcategories(ctx context.Context, storeID uuid.UUID) ([]models.Subcategory, error) {
	var subs []models.Subcategory
	err := r.db.SelectContext(ctx, &subs,
		`SELECT id, category_id, store_id, name, created_at, updated_at
		 FROM subcategories WHERE store_id = $1 ORDER BY name`,
		storeID,
	)
	return subs, err
}

// CreateStoreSubcategory создаёт подкатегорию, привязанную к магазину (category_id = NULL).
func (r *postgresRepository) CreateStoreSubcategory(ctx context.Context, storeID uuid.UUID, name string) (*models.Subcategory, error) {
	id := uuid.New()
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO subcategories (id, category_id, store_id, name, created_at, updated_at)
		 VALUES ($1, NULL, $2, $3, NOW(), NOW())`,
		id, storeID, name,
	)
	if err != nil {
		return nil, err
	}
	var sub models.Subcategory
	err = r.db.GetContext(ctx, &sub,
		`SELECT id, category_id, store_id, name, created_at, updated_at FROM subcategories WHERE id = $1`,
		id,
	)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// DeleteStoreSubcategory удаляет подкатегорию магазина. Товары, ссылавшиеся на неё, остаются
// (subcategory_id уйдёт в NULL по FK ON DELETE SET NULL).
// Проверяет, что подкатегория действительно принадлежит этому магазину, чтобы случайно не удалить глобальную.
func (r *postgresRepository) DeleteStoreSubcategory(ctx context.Context, storeID, subID uuid.UUID) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM subcategories WHERE id = $1 AND store_id = $2`,
		subID, storeID,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("подкатегория не найдена в этом магазине")
	}
	return nil
}

// CountProductsInSubcategory нужен фронту, чтобы предупредить пользователя
// «удаление подкатегории отвяжет N товаров» перед DELETE.
func (r *postgresRepository) CountProductsInSubcategory(ctx context.Context, subID uuid.UUID) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM products WHERE subcategory_id = $1`, subID)
	return n, err
}

// StoreHasDependencies возвращает количество заказов и сборщиков, привязанных к магазину.
// Используется чтобы выбрать между hard delete и архивацией.
func (r *postgresRepository) StoreHasDependencies(ctx context.Context, id uuid.UUID) (int, int, error) {
	var orders, pickers int
	if err := r.db.GetContext(ctx, &orders, `SELECT COUNT(*) FROM orders WHERE store_id = $1`, id); err != nil {
		return 0, 0, err
	}
	if err := r.db.GetContext(ctx, &pickers, `SELECT COUNT(*) FROM users WHERE store_id = $1 AND role = 'PICKER'`, id); err != nil {
		return 0, 0, err
	}
	return orders, pickers, nil
}

// CreateProduct сохраняет новый товар.
func (r *postgresRepository) CreateProduct(ctx context.Context, product *models.Product) error {
	query := `
		INSERT INTO products (id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at)
		VALUES (:id, :category_id, :subcategory_id, :store_id, :name, :description, :image_url, :price, :weight, :is_available, :created_at, :updated_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, product)
	return err
}

// DeleteProduct удаляет товар по ID.
func (r *postgresRepository) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM products WHERE id = $1`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("товар не найден")
	}
	return nil
}

// UpdateOrderStatus обновляет статус заказа.
func (r *postgresRepository) UpdateOrderStatus(ctx context.Context, id uuid.UUID, status models.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// GetOrderUserID возвращает user_id заказа (nil для гостевого).
func (r *postgresRepository) GetOrderUserID(ctx context.Context, id uuid.UUID) (*uuid.UUID, error) {
	var userID *uuid.UUID
	err := r.db.GetContext(ctx, &userID, `SELECT user_id FROM orders WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return userID, nil
}

// GetCategoryAndStoreMaps возвращает словари для поиска ID по имени.
func (r *postgresRepository) GetCategoryAndStoreMaps(ctx context.Context) (map[string]uuid.UUID, map[string]uuid.UUID, error) {
	categoryMap := make(map[string]uuid.UUID)
	storeMap := make(map[string]uuid.UUID)

	type row struct {
		ID   uuid.UUID `db:"id"`
		Name string    `db:"name"`
	}

	var categories []row
	if err := r.db.SelectContext(ctx, &categories, `SELECT id, name FROM categories`); err != nil {
		return nil, nil, err
	}
	for _, item := range categories {
		categoryMap[strings.ToLower(item.Name)] = item.ID
	}

	var stores []row
	if err := r.db.SelectContext(ctx, &stores, `SELECT id, name FROM stores`); err != nil {
		return nil, nil, err
	}
	for _, item := range stores {
		storeMap[strings.ToLower(item.Name)] = item.ID
	}

	return categoryMap, storeMap, nil
}

// BulkInsertProducts вставляет товары в транзакции.
func (r *postgresRepository) BulkInsertProducts(ctx context.Context, rows []ImportProductRow) error {
	if len(rows) == 0 {
		return nil
	}

	return r.db.WithTx(ctx, func(tx *sqlx.Tx) error {
		query := `
			INSERT INTO products (id, category_id, subcategory_id, store_id, name, description, price, is_available, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
		`
		for _, row := range rows {
			if _, err := tx.ExecContext(ctx, query, uuid.New(), row.CategoryID, row.SubcategoryID, row.StoreID, row.Name, row.Description, row.Price); err != nil {
				return fmt.Errorf("ошибка вставки строки %d: %w", row.RowNumber, err)
			}
		}
		return nil
	})
}

// newStoreFromRequest преобразует входящий запрос в модель Store.
func newStoreFromRequest(req *CreateStoreRequest) *models.Store {
	now := time.Now()
	rating := 0.0
	if req.Rating != nil {
		rating = *req.Rating
	}

	return &models.Store{
		ID:           uuid.New(),
		Name:         req.Name,
		Address:      req.Address,
		City:         req.City,
		Phone:        req.Phone,
		Description:  req.Description,
		ImageURL:     req.ImageURL,
		Rating:       rating,
		CategoryType: req.CategoryType,
		OpensAt:      req.OpensAt,
		ClosesAt:     req.ClosesAt,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// newProductFromRequest преобразует входящий запрос в модель Product.
func newProductFromRequest(req *CreateProductRequest) *models.Product {
	now := time.Now()
	isAvailable := true
	if req.IsAvailable != nil {
		isAvailable = *req.IsAvailable
	}

	return &models.Product{
		ID:            uuid.New(),
		CategoryID:    req.CategoryID,
		SubcategoryID: req.SubcategoryID,
		StoreID:       req.StoreID,
		Name:          req.Name,
		Description:   req.Description,
		ImageURL:      req.ImageURL,
		Price:         req.Price,
		Weight:        req.Weight,
		IsAvailable:   isAvailable,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

// UpdateProductRequest — поля для частичного обновления товара.
type UpdateProductRequest struct {
	Name        *string    `json:"name"`
	Price       *float64   `json:"price"`
	Description *string    `json:"description"`
	ImageURL    *string    `json:"image_url"`
	IsAvailable *bool      `json:"is_available"`
	CategoryID  *uuid.UUID `json:"category_id"`
}

// GetProductsByStore возвращает все товары магазина.
func (r *postgresRepository) GetProductsByStore(ctx context.Context, storeID uuid.UUID) ([]models.Product, error) {
	var products []models.Product
	query := `
		SELECT id, category_id, subcategory_id, store_id, name, description, image_url,
		       price, weight, is_available, created_at, updated_at
		FROM products
		WHERE store_id = $1
		ORDER BY name ASC
	`
	err := r.db.SelectContext(ctx, &products, query, storeID)
	return products, err
}

// UpdateProduct обновляет только переданные поля товара.
func (r *postgresRepository) UpdateProduct(ctx context.Context, id uuid.UUID, req *UpdateProductRequest) (*models.Product, error) {
	setClauses := []string{"updated_at = NOW()"}
	args := []any{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Price != nil {
		setClauses = append(setClauses, fmt.Sprintf("price = $%d", argIdx))
		args = append(args, *req.Price)
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.ImageURL != nil {
		setClauses = append(setClauses, fmt.Sprintf("image_url = $%d", argIdx))
		args = append(args, *req.ImageURL)
		argIdx++
	}
	if req.IsAvailable != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_available = $%d", argIdx))
		args = append(args, *req.IsAvailable)
		argIdx++
	}
	if req.CategoryID != nil {
		setClauses = append(setClauses, fmt.Sprintf("category_id = $%d", argIdx))
		args = append(args, *req.CategoryID)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf(
		`UPDATE products SET %s WHERE id = $%d
		 RETURNING id, category_id, subcategory_id, store_id, name, description, image_url, price, weight, is_available, created_at, updated_at`,
		strings.Join(setClauses, ", "),
		argIdx,
	)

	var product models.Product
	if err := r.db.GetContext(ctx, &product, query, args...); err != nil {
		return nil, fmt.Errorf("товар не найден или ошибка обновления: %w", err)
	}
	return &product, nil
}

// GetFeaturedList возвращает записи витрины по типу блока.
func (r *postgresRepository) GetFeaturedList(ctx context.Context, blockType models.FeaturedBlockType) ([]models.FeaturedProduct, error) {
	var items []models.FeaturedProduct
	query := `SELECT id, product_id, block_type, position, created_at
	          FROM featured_products WHERE block_type = $1 ORDER BY position ASC`
	err := r.db.SelectContext(ctx, &items, query, blockType)
	return items, err
}

// AddFeatured добавляет товар в блок витрины.
func (r *postgresRepository) AddFeatured(ctx context.Context, fp *models.FeaturedProduct) error {
	// UPSERT: если товар уже есть в этом блоке витрины,
	// просто обновляем его позицию вместо ошибки unique violation.
	query := `INSERT INTO featured_products (id, product_id, block_type, position, created_at)
	          VALUES (:id, :product_id, :block_type, :position, :created_at)
	          ON CONFLICT (block_type, product_id)
	          DO UPDATE SET position = EXCLUDED.position`
	_, err := r.db.NamedExecContext(ctx, query, fp)
	return err
}

// DeleteFeatured удаляет запись витрины по ID.
func (r *postgresRepository) DeleteFeatured(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM featured_products WHERE id = $1`, id)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("запись не найдена")
	}
	return nil
}

var errInvalidStatus = fmt.Errorf("некорректный статус заказа")

// GetCategories возвращает все категории.
func (r *postgresRepository) GetCategories(ctx context.Context) ([]models.Category, error) {
	var cats []models.Category
	err := r.db.SelectContext(ctx, &cats, `SELECT id, name, description, image_url, created_at, updated_at FROM categories ORDER BY name`)
	return cats, err
}

// CreateCategory создаёт новую категорию.
func (r *postgresRepository) CreateCategory(ctx context.Context, cat *models.Category) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO categories (id, name, description, image_url, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`,
		cat.ID, cat.Name, cat.Description, cat.ImageURL,
	)
	return err
}

// UpdateCategoryImage обновляет фоновое изображение категории.
func (r *postgresRepository) UpdateCategoryImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE categories SET image_url = $1, updated_at = NOW() WHERE id = $2`,
		imageURL, id,
	)
	return err
}

// UpdateCategoryName обновляет название категории.
func (r *postgresRepository) UpdateCategoryName(ctx context.Context, id uuid.UUID, name string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE categories SET name = $1, updated_at = NOW() WHERE id = $2`,
		name, id,
	)
	return err
}

// DeleteCategory удаляет категорию (без удаления товаров).
func (r *postgresRepository) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM categories WHERE id = $1`, id)
	return err
}

// CreatePicker создаёт пользователя с ролью PICKER, привязанного к магазину.
func (r *postgresRepository) CreatePicker(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, phone, role, store_id, password_hash, created_at, updated_at)
		VALUES (:id, :phone, :role, :store_id, :password_hash, :created_at, :updated_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, user)
	return err
}

// GetPickers возвращает всех сборщиков с названиями привязанных магазинов.
func (r *postgresRepository) GetPickers(ctx context.Context) ([]PickerInfo, error) {
	pickers := []PickerInfo{}
	query := `
		SELECT u.id, u.phone, u.store_id, COALESCE(s.name, '') AS store_name, u.created_at
		FROM users u
		LEFT JOIN stores s ON s.id = u.store_id
		WHERE u.role = 'PICKER'
		ORDER BY u.created_at DESC
	`
	if err := r.db.SelectContext(ctx, &pickers, query); err != nil {
		return nil, err
	}
	return pickers, nil
}

// DeletePicker удаляет сборщика. В транзакции отвязывает его от исторических
// заказов (picker_id = NULL), чтобы не нарушить FK orders.picker_id → users.
// Защита от удаления не-PICKER через проверку роли в SQL.
func (r *postgresRepository) DeletePicker(ctx context.Context, id uuid.UUID) error {
	return r.db.WithTx(ctx, func(tx *sqlx.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE orders SET picker_id = NULL WHERE picker_id = $1`, id); err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `DELETE FROM users WHERE id = $1 AND role = 'PICKER'`, id)
		if err != nil {
			return err
		}
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return fmt.Errorf("сборщик не найден")
		}
		return nil
	})
}

// UpdatePickerStore меняет магазин, к которому привязан сборщик.
func (r *postgresRepository) UpdatePickerStore(ctx context.Context, id uuid.UUID, storeID uuid.UUID) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE users SET store_id = $1, updated_at = NOW() WHERE id = $2 AND role = 'PICKER'`,
		storeID, id,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("сборщик не найден")
	}
	return nil
}

// UpdatePickerPassword меняет пароль сборщика (хэш уже посчитан в сервисе).
func (r *postgresRepository) UpdatePickerPassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND role = 'PICKER'`,
		passwordHash, id,
	)
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("сборщик не найден")
	}
	return nil
}

// IsPhoneTaken проверяет, существует ли уже пользователь с этим телефоном.
func (r *postgresRepository) IsPhoneTaken(ctx context.Context, phone string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)`, phone)
	return exists, err
}
