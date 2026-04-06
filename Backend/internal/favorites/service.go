package favorites

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Service содержит бизнес-логику для избранного.
type Service struct {
	repo   Repository
	logger *zap.Logger
}

// NewService создаёт новый Service.
func NewService(repo Repository, logger *zap.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) Add(ctx context.Context, userID, productID uuid.UUID) error {
	return s.repo.Add(ctx, userID, productID)
}

func (s *Service) Remove(ctx context.Context, userID, productID uuid.UUID) error {
	return s.repo.Remove(ctx, userID, productID)
}

func (s *Service) GetByUser(ctx context.Context, userID uuid.UUID) ([]models.Product, error) {
	products, err := s.repo.GetByUser(ctx, userID)
	if err != nil {
		s.logger.Error("Ошибка получения избранного", zap.String("user_id", userID.String()), zap.Error(err))
		return nil, err
	}
	return products, nil
}
