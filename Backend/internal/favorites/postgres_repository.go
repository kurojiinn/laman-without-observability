package favorites

import (
	"context"

	"Laman/internal/database"
	"Laman/internal/models"

	"github.com/google/uuid"
)

type postgresRepository struct {
	db *database.DB
}

// NewPostgresRepository создаёт реализацию Repository на базе PostgreSQL.
func NewPostgresRepository(db *database.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) Add(ctx context.Context, userID, productID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, productID,
	)
	return err
}

func (r *postgresRepository) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM favorites WHERE user_id = $1 AND product_id = $2`,
		userID, productID,
	)
	return err
}

func (r *postgresRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]models.Product, error) {
	var products []models.Product
	err := r.db.SelectContext(ctx, &products, `
		SELECT p.*
		FROM products p
		INNER JOIN favorites f ON f.product_id = p.id
		WHERE f.user_id = $1
		ORDER BY f.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	return products, nil
}
