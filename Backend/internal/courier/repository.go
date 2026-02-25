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
}
