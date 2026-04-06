package favorites

import (
	"context"

	"Laman/internal/models"

	"github.com/google/uuid"
)

// Repository описывает контракт хранилища для избранного.
type Repository interface {
	Add(ctx context.Context, userID, productID uuid.UUID) error
	Remove(ctx context.Context, userID, productID uuid.UUID) error
	GetByUser(ctx context.Context, userID uuid.UUID) ([]models.Product, error)
}
