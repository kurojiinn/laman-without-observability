package courier

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repository Repository
}

// NewCourierService создаёт новый сервис позиций курьеров на основе репозитория.
func NewCourierService(repository Repository) *Service {
	return &Service{repository: repository}
}

// UpdateLocation обновляем данные в кеше
func (s *Service) UpdateLocation(ctx context.Context, courierID uuid.UUID, lat, lng float64) error {
	if lat < -90 || lat > 90 {
		return fmt.Errorf("ширина не в диапазоне от -90 до 90: %v", lat)
	}

	if lng < -180 || lng > 180 {
		return fmt.Errorf("долгота не в диапазоне от -180 до 180:  %v", lng)
	}

	return s.repository.SetLocation(ctx, courierID, lat, lng)
}
