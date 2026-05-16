package banners

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"Laman/internal/database"
	"Laman/internal/models"

	"github.com/google/uuid"
)

type postgresRepository struct {
	db *database.DB
}

func NewPostgresRepository(db *database.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) GetActive(ctx context.Context) ([]models.Banner, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, title, description, image_url, link, is_active, sort_order, created_at, updated_at
		FROM banners WHERE is_active = true ORDER BY sort_order ASC, created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("banners.GetActive: %w", err)
	}
	defer rows.Close()
	return scanBanners(rows)
}

func (r *postgresRepository) GetAll(ctx context.Context) ([]models.Banner, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, title, description, image_url, link, is_active, sort_order, created_at, updated_at
		FROM banners ORDER BY sort_order ASC, created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("banners.GetAll: %w", err)
	}
	defer rows.Close()
	return scanBanners(rows)
}

func (r *postgresRepository) Create(ctx context.Context, b *models.Banner) error {
	b.ID = uuid.New()
	now := time.Now()
	b.CreatedAt = now
	b.UpdatedAt = now
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO banners (id, title, description, image_url, link, is_active, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		b.ID, b.Title, b.Description, b.ImageURL, b.Link, b.IsActive, b.SortOrder, b.CreatedAt, b.UpdatedAt)
	if err != nil {
		return fmt.Errorf("banners.Create: %w", err)
	}
	return nil
}

func (r *postgresRepository) Update(ctx context.Context, id uuid.UUID, b *models.Banner) error {
	b.UpdatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, `
		UPDATE banners
		SET title=$1, description=$2, image_url=$3, link=$4, is_active=$5, sort_order=$6, updated_at=$7
		WHERE id=$8`,
		b.Title, b.Description, b.ImageURL, b.Link, b.IsActive, b.SortOrder, b.UpdatedAt, id)
	if err != nil {
		return fmt.Errorf("banners.Update: %w", err)
	}
	return nil
}

func (r *postgresRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM banners WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("banners.Delete: %w", err)
	}
	return nil
}

func (r *postgresRepository) UpdateImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE banners SET image_url=$1, updated_at=$2 WHERE id=$3`,
		imageURL, time.Now(), id)
	if err != nil {
		return fmt.Errorf("banners.UpdateImage: %w", err)
	}
	return nil
}

func scanBanners(rows *sql.Rows) ([]models.Banner, error) {
	var result []models.Banner
	for rows.Next() {
		var b models.Banner
		if err := rows.Scan(
			&b.ID, &b.Title, &b.Description, &b.ImageURL, &b.Link,
			&b.IsActive, &b.SortOrder, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("banners.scan: %w", err)
		}
		result = append(result, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("banners.rows: %w", err)
	}
	return result, nil
}
