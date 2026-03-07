package courier

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Location struct {
	Lat       float64
	Lng       float64
	UpdatedAt time.Time
}

type Repository interface {
	SetLocation(ctx context.Context, courierID uuid.UUID, lat, lng float64) error
	GetLocation(ctx context.Context, courierID uuid.UUID) (*Location, error)
	AddToActivePool(ctx context.Context, courierID uuid.UUID, lat, lng float64) error
	RemoveFromActivePool(ctx context.Context, courierID uuid.UUID) error
	// FindNearest возвращает список ID курьеров отсортированных по расстоянию
	// от указанной точки в заданном радиусе. Использует Redis GEO для поиска.
	FindNearest(ctx context.Context, lat, lng float64, radiusKm float64) ([]string, error)
}
