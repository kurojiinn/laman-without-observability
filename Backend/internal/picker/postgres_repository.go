package picker

import (
	"Laman/internal/database"
	"Laman/internal/models"
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type postgresPikerRepository struct {
	db *database.DB
}

// NewPostgresPikerRepository создает новый PostgreSQL репозиторий заказов.
func NewPostgresPikerRepository(db *database.DB) PickerRepository {
	return &postgresPikerRepository{db: db}
}

func (r *postgresPikerRepository) GetOrderByID(ctx context.Context, id uuid.UUID) (*models.Order, error) {
	var order models.Order
	query := `
		SELECT o.id, o.user_id, o.courier_id,
		       o.customer_phone, o.comment, o.status, o.store_id, o.payment_method,
		       o.items_total, o.service_fee, o.delivery_fee, o.final_total,
		       o.out_of_stock_action, o.delivery_type, o.scheduled_at, o.delivery_surcharge,
		       o.created_at, o.updated_at,
		       o.picker_id, d.address AS delivery_address
		FROM orders o
		LEFT JOIN deliveries d ON d.order_id = o.id
		WHERE o.id = $1
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

func (r *postgresPikerRepository) GetOrders(ctx context.Context, storeID uuid.UUID) ([]models.Order, error) {
	var orders []models.Order
	query := `
		SELECT o.id, o.user_id, o.courier_id,
		       o.customer_phone, o.comment, o.status, o.store_id, o.payment_method,
		       o.items_total, o.service_fee, o.delivery_fee, o.final_total,
		       o.out_of_stock_action, o.delivery_type, o.scheduled_at, o.delivery_surcharge,
		       o.created_at, o.updated_at,
		       o.picker_id, d.address AS delivery_address
		FROM orders o
		LEFT JOIN deliveries d ON d.order_id = o.id
		WHERE o.store_id = $1
		  AND o.status IN (
		    'NEW', 'ACCEPTED_BY_PICKER', 'ASSEMBLING', 'ASSEMBLED', 'NEEDS_CONFIRMATION',
		    'WAITING_COURIER', 'COURIER_PICKED_UP', 'DELIVERING', 'DELIVERED', 'CANCELLED'
		  )
		  AND o.created_at >= NOW() - INTERVAL '30 days'
		ORDER BY o.created_at ASC
	`
	err := r.db.SelectContext(ctx, &orders, query, storeID)
	if err != nil {
		return nil, fmt.Errorf("ошибка получения заказов: %w", err)
	}
	return orders, nil
}

func (r *postgresPikerRepository) UpdateStatus(ctx context.Context, orderID uuid.UUID, status models.OrderStatus) error {
	query := `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`

	result, err := r.db.ExecContext(ctx, query, status, orderID)
	if err != nil {
		return fmt.Errorf("ошибка получения заказов: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("заказ не найден")
	}

	return nil
}

func (r *postgresPikerRepository) UpdateStatusAndAssignPicker(ctx context.Context, orderID uuid.UUID, status models.OrderStatus, pickerID uuid.UUID) error {
	query := `
		UPDATE orders
		SET status = $1,
		    picker_id = COALESCE(picker_id, $2),
		    updated_at = NOW()
		WHERE id = $3
		  AND (picker_id IS NULL OR picker_id = $2)
	`

	result, err := r.db.ExecContext(ctx, query, status, pickerID, orderID)
	if err != nil {
		return fmt.Errorf("ошибка назначения сборщика: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("заказ уже взят другим сборщиком или не существует")
	}

	return nil
}

func (r *postgresPikerRepository) GetOrderItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]PickerOrderItem, error) {
	var items []PickerOrderItem
	query := `
		SELECT oi.id, oi.product_id, COALESCE(oi.product_name, p.name) AS product_name, p.image_url, oi.quantity, oi.price
		FROM order_items oi
		LEFT JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at
	`
	err := r.db.SelectContext(ctx, &items, query, orderID)
	if err != nil {
		return nil, fmt.Errorf("ошибка получения товаров заказа: %w", err)
	}
	return items, nil
}

func (r *postgresPikerRepository) AddOrderItem(ctx context.Context, orderID uuid.UUID, name string, price float64, quantity int) (*PickerOrderItem, error) {
	var item PickerOrderItem
	query := `
		INSERT INTO order_items (order_id, product_name, price, quantity)
		VALUES ($1, $2, $3, $4)
		RETURNING id, product_id, product_name, quantity, price
	`
	err := r.db.GetContext(ctx, &item, query, orderID, name, price, quantity)
	if err != nil {
		return nil, fmt.Errorf("ошибка добавления товара: %w", err)
	}
	return &item, nil
}

func (r *postgresPikerRepository) RemoveOrderItem(ctx context.Context, itemID uuid.UUID) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM order_items WHERE id = $1`, itemID)
	if err != nil {
		return fmt.Errorf("ошибка удаления товара: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("товар не найден")
	}
	return nil
}

func (r *postgresPikerRepository) RecalcOrderTotals(ctx context.Context, orderID uuid.UUID, serviceFeePercent float64) error {
	query := `
		UPDATE orders
		SET items_total = COALESCE((SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1), 0),
		    service_fee = COALESCE((SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1), 0) * $2 / 100,
		    final_total = COALESCE((SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1), 0)
		              + COALESCE((SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1), 0) * $2 / 100
		              + delivery_fee,
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, orderID, serviceFeePercent)
	if err != nil {
		return fmt.Errorf("ошибка пересчёта суммы заказа: %w", err)
	}
	return nil
}

// GetTopProducts агрегирует продажи по магазину за период (since..now).
// Группируем по имени товара (а не по product_id), чтобы вручную добавленные
// сборщиком позиции с одинаковым именем тоже схлопывались в одну строку.
// Отменённые заказы не учитываем — товары там фактически не проданы.
func (r *postgresPikerRepository) GetTopProducts(ctx context.Context, storeID uuid.UUID, since time.Time, limit int) ([]TopProduct, error) {
	if limit <= 0 {
		limit = 10
	}
	query := `
		SELECT
			COALESCE(p.name, oi.product_name, '') AS name,
			MIN(p.image_url) AS image_url,
			SUM(oi.quantity)::int AS total_qty,
			SUM(oi.quantity * oi.price) AS total_revenue
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		LEFT JOIN products p ON p.id = oi.product_id
		WHERE o.store_id = $1
		  AND o.created_at >= $2
		  AND o.status <> 'CANCELLED'
		GROUP BY COALESCE(p.name, oi.product_name, '')
		HAVING COALESCE(p.name, oi.product_name, '') <> ''
		ORDER BY total_qty DESC, total_revenue DESC
		LIMIT $3
	`
	var rows []TopProduct
	if err := r.db.SelectContext(ctx, &rows, query, storeID, since, limit); err != nil {
		return nil, fmt.Errorf("ошибка получения топа товаров: %w", err)
	}
	return rows, nil
}

func (r *postgresPikerRepository) AssignPicker(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID) error {
	query := `UPDATE orders SET picker_id = $1, updated_at = NOW() WHERE id = $2 AND (picker_id IS NULL OR picker_id = $1)`

	result, err := r.db.ExecContext(ctx, query, pickerID, orderID)
	if err != nil {
		return fmt.Errorf("ошибка получения сборщиков: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("заказ уже взят другим сборщиком или не существует")
	}

	return nil
}
