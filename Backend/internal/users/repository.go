package users

import (
	"context"
	"errors"
	"Laman/internal/models"
	"github.com/google/uuid"
)

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrProfileNotFound = errors.New("profile not found")
)

// UserRepository определяет интерфейс для доступа к данным пользователей.
type UserRepository interface {
	// Create создает нового пользователя.
	Create(ctx context.Context, user *models.User) error
	
	// GetByID получает пользователя по ID.
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	
	// GetByPhone получает пользователя по номеру телефона.
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	
	// CreateProfile создает профиль пользователя.
	CreateProfile(ctx context.Context, profile *models.UserProfile) error
	
	// GetProfile получает профиль пользователя по ID пользователя.
	GetProfile(ctx context.Context, userID uuid.UUID) (*models.UserProfile, error)
	
	// UpdateProfile обновляет профиль пользователя.
	UpdateProfile(ctx context.Context, profile *models.UserProfile) error
}
