package orders

import (
	"Laman/internal/database"
	"Laman/internal/models"
	"context"
	"database/sql"
	"fmt"
	"github.com/google/uuid"
)

// postgresOrderRepository реализует OrderRepository используя PostgreSQL.
type postgresOrderRepository struct {
	db *database.DB
}

// NewPostgresOrderRepository создает новый PostgreSQL репозиторий заказов.
func NewPostgresOrderRepository(db *database.DB) OrderRepository {
	return &postgresOrderRepository{db: db}
}

func (r *postgresOrderRepository) Create(ctx context.Context, order *models.Order) error {
	query := `
		INSERT INTO orders (id, user_id, guest_name, guest_phone, guest_address, comment, status,
		                    store_id, payment_method, items_total, service_fee, delivery_fee, final_total, created_at, updated_at)
		VALUES (:id, :user_id, :guest_name, :guest_phone, :guest_address, :comment, :status,
		        :store_id, :payment_method, :items_total, :service_fee, :delivery_fee, :final_total, :created_at, :updated_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, order)
	return err
}

func (r *postgresOrderRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error) {
	var order models.Order
	query := `
		SELECT id, user_id, guest_name, guest_phone, guest_address, comment, status, store_id, payment_method,
		       items_total, service_fee, delivery_fee, final_total, created_at, updated_at
		FROM orders WHERE id = $1
	`
	err := r.db.GetContext(ctx, &order, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("заказ не найден")
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *postgresOrderRepository) GetByUserID(ctx context.Context, userID uuid.UUID) ([]models.Order, error) {
	var orders []models.Order
	query := `
		SELECT id, user_id, guest_name, guest_phone, guest_address, comment, status, store_id, payment_method,
		       items_total, service_fee, delivery_fee, final_total, created_at, updated_at
		FROM orders WHERE user_id = $1 ORDER BY created_at DESC
	`
	err := r.db.SelectContext(ctx, &orders, query, userID)
	return orders, err
}

func (r *postgresOrderRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *postgresOrderRepository) Update(ctx context.Context, order *models.Order) error {
	query := `
		UPDATE orders
		SET user_id = :user_id, guest_name = :guest_name, guest_phone = :guest_phone,
		    guest_address = :guest_address, comment = :comment, status = :status, store_id = :store_id, payment_method = :payment_method,
		    items_total = :items_total, service_fee = :service_fee, delivery_fee = :delivery_fee,
		    final_total = :final_total, updated_at = :updated_at
		WHERE id = :id
	`
	_, err := r.db.NamedExecContext(ctx, query, order)
	return err
}

// postgresOrderItemRepository реализует OrderItemRepository используя PostgreSQL.
type postgresOrderItemRepository struct {
	db *database.DB
}

// NewPostgresOrderItemRepository создает новый PostgreSQL репозиторий товаров заказа.
func NewPostgresOrderItemRepository(db *database.DB) OrderItemRepository {
	return &postgresOrderItemRepository{db: db}
}

func (r *postgresOrderItemRepository) Create(ctx context.Context, item *models.OrderItem) error {
	query := `
		INSERT INTO order_items (id, order_id, product_id, quantity, price, created_at)
		VALUES (:id, :order_id, :product_id, :quantity, :price, :created_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, item)
	return err
}

func (r *postgresOrderItemRepository) CreateBatch(ctx context.Context, items []models.OrderItem) error {
	if len(items) == 0 {
		return nil
	}

	query := `
		INSERT INTO order_items (id, order_id, product_id, quantity, price, created_at)
		VALUES (:id, :order_id, :product_id, :quantity, :price, :created_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, items)
	return err
}

func (r *postgresOrderItemRepository) GetByOrderID(ctx context.Context, orderID uuid.UUID) ([]models.OrderItem, error) {
	var items []models.OrderItem
	query := `SELECT id, order_id, product_id, quantity, price, created_at FROM order_items WHERE order_id = $1 ORDER BY created_at`
	err := r.db.SelectContext(ctx, &items, query, orderID)
	return items, err
}
