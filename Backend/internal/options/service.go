package options

import (
	"context"
	"fmt"
	"strings"

	"Laman/internal/models"

	"github.com/google/uuid"
)

// ServiceImpl — реализация Service над Repository.
type ServiceImpl struct {
	repo Repository
}

// NewService создаёт сервис опций.
func NewService(repo Repository) *ServiceImpl {
	return &ServiceImpl{repo: repo}
}

func (s *ServiceImpl) GetGroupsByProduct(ctx context.Context, productID uuid.UUID) ([]models.ProductOptionGroup, error) {
	return s.repo.GetGroupsByProduct(ctx, productID)
}

func (s *ServiceImpl) GetGroupsByProductIDs(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID][]models.ProductOptionGroup, error) {
	return s.repo.GetGroupsByProductIDs(ctx, productIDs)
}

func (s *ServiceImpl) CreateGroup(ctx context.Context, productID uuid.UUID, name, kind string, isRequired bool, position int) (*models.ProductOptionGroup, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("название группы обязательно")
	}
	if kind == "" {
		kind = "variant"
	}
	if kind != "variant" && kind != "flag" {
		return nil, fmt.Errorf("kind должен быть variant или flag")
	}
	g := &models.ProductOptionGroup{
		ID:         uuid.New(),
		ProductID:  productID,
		Name:       name,
		Kind:       kind,
		IsRequired: isRequired,
		Position:   position,
	}
	if err := s.repo.CreateGroup(ctx, g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *ServiceImpl) UpdateGroup(ctx context.Context, id uuid.UUID, name, kind string, isRequired bool, position int) error {
	if kind == "" {
		kind = "variant"
	}
	if kind != "variant" && kind != "flag" {
		return fmt.Errorf("kind должен быть variant или flag")
	}
	return s.repo.UpdateGroup(ctx, id, name, kind, isRequired, position)
}

func (s *ServiceImpl) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteGroup(ctx, id)
}

func (s *ServiceImpl) CreateValue(ctx context.Context, groupID uuid.UUID, name string, priceDelta *float64, isDefault bool, position int) (*models.ProductOptionValue, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("название обязательно")
	}
	v := &models.ProductOptionValue{
		ID:         uuid.New(),
		GroupID:    groupID,
		Name:       name,
		PriceDelta: priceDelta,
		IsDefault:  isDefault,
		Position:   position,
	}
	if err := s.repo.CreateValue(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *ServiceImpl) UpdateValue(ctx context.Context, id uuid.UUID, name string, priceDelta *float64, isDefault bool, position int) error {
	return s.repo.UpdateValue(ctx, id, name, priceDelta, isDefault, position)
}

func (s *ServiceImpl) DeleteValue(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteValue(ctx, id)
}
