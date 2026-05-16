package banners

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
)

type Repository interface {
	GetActive(ctx context.Context) ([]models.Banner, error)
	GetAll(ctx context.Context) ([]models.Banner, error)
	Create(ctx context.Context, b *models.Banner) error
	Update(ctx context.Context, id uuid.UUID, b *models.Banner) error
	Delete(ctx context.Context, id uuid.UUID) error
	UpdateImage(ctx context.Context, id uuid.UUID, imageURL string) error
}
