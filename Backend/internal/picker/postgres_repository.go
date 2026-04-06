package picker

import (
	"Laman/internal/database"
	"Laman/internal/models"
	"context"
	"database/sql"
	"fmt"

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
		SELECT o.id, o.user_id, o.courier_id, o.guest_name, o.guest_phone, o.guest_address,
		       o.customer_phone, o.comment, o.status, o.store_id, o.payment_method,
		       o.items_total, o.service_fee, o.delivery_fee, o.final_total, o.created_at, o.updated_at,
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
		SELECT o.id, o.user_id, o.courier_id, o.guest_name, o.guest_phone, o.guest_address,
		       o.customer_phone, o.comment, o.status, o.store_id, o.payment_method,
		       o.items_total, o.service_fee, o.delivery_fee, o.final_total, o.created_at, o.updated_at,
		       o.picker_id, d.address AS delivery_address
		FROM orders o
		LEFT JOIN deliveries d ON d.order_id = o.id
		WHERE o.store_id = $1
		  AND o.status IN ('NEW', 'ACCEPTED_BY_PICKER', 'ASSEMBLING', 'ASSEMBLED')
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
