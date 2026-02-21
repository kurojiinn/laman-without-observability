package delivery

import (
	"context"
	"database/sql"
	"fmt"
	"Laman/internal/database"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// postgresDeliveryRepository реализует DeliveryRepository используя PostgreSQL.
type postgresDeliveryRepository struct {
	db *database.DB
}

// NewPostgresDeliveryRepository создает новый PostgreSQL репозиторий доставок.
func NewPostgresDeliveryRepository(db *database.DB) DeliveryRepository {
	return &postgresDeliveryRepository{db: db}
}

func (r *postgresDeliveryRepository) Create(ctx context.Context, delivery *models.Delivery) error {
	query := `
		INSERT INTO deliveries (id, order_id, address, distance, weight, created_at, updated_at)
		VALUES (:id, :order_id, :address, :distance, :weight, :created_at, :updated_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, delivery)
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
