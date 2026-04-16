package delivery

import (
	"context"
	"database/sql"
	"fmt"

	"Laman/internal/database"
	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// postgresDeliveryRepository реализует DeliveryRepository используя PostgreSQL.
type postgresDeliveryRepository struct {
	db *database.DB
}

// NewPostgresDeliveryRepository создает новый PostgreSQL репозиторий доставок.
func NewPostgresDeliveryRepository(db *database.DB) DeliveryRepository {
	return &postgresDeliveryRepository{db: db}
}

const insertDeliveryQuery = `
	INSERT INTO deliveries (id, order_id, address, distance, weight, created_at, updated_at)
	VALUES (:id, :order_id, :address, :distance, :weight, :created_at, :updated_at)
`

func (r *postgresDeliveryRepository) Create(ctx context.Context, delivery *models.Delivery) error {
	_, err := r.db.NamedExecContext(ctx, insertDeliveryQuery, delivery)
	return err
}

// CreateTx создаёт запись о доставке внутри транзакции.
// Вызывается из OrderService.CreateOrder для атомарного создания заказа.
func (r *postgresDeliveryRepository) CreateTx(ctx context.Context, tx *sqlx.Tx, delivery *models.Delivery) error {
	query, args, err := tx.BindNamed(insertDeliveryQuery, delivery)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}

func (r *postgresDeliveryRepository) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Delivery, error) {
	var delivery models.Delivery
	query := `SELECT id, order_id, address, distance, weight, created_at, updated_at FROM deliveries WHERE order_id = $1`
	err := r.db.GetContext(ctx, &delivery, query, orderID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("доставка не найдена")
	}
	if err != nil {
		return nil, err
	}
	return &delivery, nil
}

func (r *postgresDeliveryRepository) Update(ctx context.Context, delivery *models.Delivery) error {
	query := `
		UPDATE deliveries
		SET address = :address, distance = :distance, weight = :weight, updated_at = :updated_at
		WHERE id = :id
	`
	_, err := r.db.NamedExecContext(ctx, query, delivery)
	return err
}
