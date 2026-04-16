package orders

import (
	"Laman/internal/database"
	"Laman/internal/models"
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// postgresOrderRepository реализует OrderRepository используя PostgreSQL.
type postgresOrderRepository struct {
	db *database.DB
}

// NewPostgresOrderRepository создает новый PostgreSQL репозиторий заказов.
func NewPostgresOrderRepository(db *database.DB) OrderRepository {
	return &postgresOrderRepository{db: db}
}

const insertOrderQuery = `
	INSERT INTO orders (id, user_id, courier_id, customer_phone, comment, status,
	                    store_id, payment_method, items_total, service_fee, delivery_fee, final_total,
	                    out_of_stock_action, created_at, updated_at)
	VALUES (:id, :user_id, :courier_id, :customer_phone, :comment, :status,
	        :store_id, :payment_method, :items_total, :service_fee, :delivery_fee, :final_total,
	        :out_of_stock_action, :created_at, :updated_at)
`

func (r *postgresOrderRepository) Create(ctx context.Context, order *models.Order) error {
	_, err := r.db.NamedExecContext(ctx, insertOrderQuery, order)
	return err
}

// CreateTx создаёт заказ внутри переданной транзакции.
// Вызывается из OrderService.CreateOrder для атомарного создания заказа.
func (r *postgresOrderRepository) CreateTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
	query, args, err := tx.BindNamed(insertOrderQuery, order)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}

func (r *postgresOrderRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error) {
	var order models.Order
	query := `
		SELECT id, user_id, courier_id, customer_phone, comment, status, store_id, payment_method,
		       items_total, service_fee, delivery_fee, final_total, out_of_stock_action, created_at, updated_at
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
		SELECT id, user_id, courier_id, customer_phone, comment, status, store_id, payment_method,
		       items_total, service_fee, delivery_fee, final_total, out_of_stock_action, created_at, updated_at
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
		SET user_id = :user_id, courier_id = :courier_id, customer_phone = :customer_phone,
		    comment = :comment, status = :status, store_id = :store_id, payment_method = :payment_method,
		    items_total = :items_total, service_fee = :service_fee, delivery_fee = :delivery_fee,
		    final_total = :final_total, out_of_stock_action = :out_of_stock_action, updated_at = :updated_at
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

const insertOrderItemQuery = `
	INSERT INTO order_items (id, order_id, product_id, quantity, price, created_at)
	VALUES (:id, :order_id, :product_id, :quantity, :price, :created_at)
`

// CreateBatchTx создаёт позиции заказа внутри транзакции.
// Используется совместно с postgresOrderRepository.CreateTx.
func (r *postgresOrderItemRepository) CreateBatchTx(ctx context.Context, tx *sqlx.Tx, items []models.OrderItem) error {
	if len(items) == 0 {
		return nil
	}
	for _, item := range items {
		query, args, err := tx.BindNamed(insertOrderItemQuery, item)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, query, args...); err != nil {
			return err
		}
	}
	return nil
}

func (r *postgresOrderItemRepository) GetByOrderID(ctx context.Context, orderID uuid.UUID) ([]models.OrderItem, error) {
	var items []models.OrderItem
	query := `
		SELECT oi.id, oi.order_id, oi.product_id,
		       COALESCE(oi.product_name, p.name, '') AS product_name,
		       oi.quantity, oi.price, oi.created_at
		FROM order_items oi
		LEFT JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at`
	err := r.db.SelectContext(ctx, &items, query, orderID)
	return items, err
}
