package banners

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetActive(ctx context.Context) ([]models.Banner, error) {
	return s.repo.GetActive(ctx)
}

func (s *Service) GetAll(ctx context.Context) ([]models.Banner, error) {
	return s.repo.GetAll(ctx)
}

func (s *Service) Create(ctx context.Context, b *models.Banner) error {
	return s.repo.Create(ctx, b)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, b *models.Banner) error {
	return s.repo.Update(ctx, id, b)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) UpdateImage(ctx context.Context, id uuid.UUID, imageURL string) error {
	return s.repo.UpdateImage(ctx, id, imageURL)
}
