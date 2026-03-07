package courier

import (
	"Laman/internal/observability"
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
	ctx, span := observability.StartSpan(ctx, "courier.service.update_location")
	defer span.End()
	if lat < -90 || lat > 90 {
		return fmt.Errorf("ширина не в диапазоне от -90 до 90: %v", lat)
	}

	if lng < -180 || lng > 180 {
		return fmt.Errorf("долгота не в диапазоне от -180 до 180:  %v", lng)
	}

	return s.repository.SetLocation(ctx, courierID, lat, lng)
}

// GetLocation позволяет получить данные о местонахдение курьера
func (s *Service) GetLocation(ctx context.Context, courierID uuid.UUID) (*Location, error) {
	ctx, span := observability.StartSpan(ctx, "courier.service.get_location")
	defer span.End()
	location, err := s.repository.GetLocation(ctx, courierID)
	if err != nil {
		return nil, fmt.Errorf("ошибка при получении данных о местонахождении курьера: %w", err)
	}
	return location, err
}

func (s *Service) StartShift(ctx context.Context, courierID uuid.UUID, lat, lng float64) error {
	ctx, span := observability.StartSpan(ctx, "courier.service.start_shift")
	defer span.End()

	err := s.repository.AddToActivePool(ctx, courierID, lat, lng)
	if err != nil {
		return fmt.Errorf("ошибка %w", err)
	}

	return nil
}

func (s *Service) EndShift(ctx context.Context, courierID uuid.UUID) error {
	ctx, span := observability.StartSpan(ctx, "courier.service.end_shift")
	defer span.End()

	err := s.repository.RemoveFromActivePool(ctx, courierID)
	if err != nil {
		return fmt.Errorf("ошибка при удалении %w", err)
	}
	return nil
}

func (s *Service) FindNearestCourier(ctx context.Context, lat, lng float64, radiusKm float64) (*uuid.UUID, error) {
	ctx, span := observability.StartSpan(ctx, "courier.service.find_nearest_courier")
	defer span.End()

	res, err := s.repository.FindNearest(ctx, lat, lng, radiusKm)
	if err != nil {
		return nil, fmt.Errorf("ошибка при получении списка курьеров: %w", err)
	}

	if len(res) == 0 {
		return nil, nil
	}

	courierID, err := uuid.Parse(res[0])
	if err != nil {
		return nil, fmt.Errorf("ошибка при парсинге айди курьера: %w", err)
	}
	return &courierID, nil
}
