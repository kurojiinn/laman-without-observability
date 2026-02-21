package users

import (
	"context"
	"fmt"
	"time"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// UserService обрабатывает бизнес-логику, связанную с пользователями и профилями.
type UserService struct {
	userRepo UserRepository
}

// NewUserService создает новый сервис пользователей.
func NewUserService(userRepo UserRepository) *UserService {
	return &UserService{
		userRepo: userRepo,
	}
}

// GetProfile получает профиль пользователя по ID пользователя.
func (s *UserService) GetProfile(ctx context.Context, userID uuid.UUID) (*models.UserProfile, error) {
	profile, err := s.userRepo.GetProfile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить профиль: %w", err)
	}
	return profile, nil
}

// UpdateProfileRequest представляет запрос на обновление профиля пользователя.
type UpdateProfileRequest struct {
	Name    string  `json:"name" binding:"required"`
	Email   *string `json:"email,omitempty"`
	Address *string `json:"address,omitempty"`
}

// UpdateProfile обновляет профиль пользователя.
func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) (*models.UserProfile, error) {
	// Попытка получить существующий профиль
	profile, err := s.userRepo.GetProfile(ctx, userID)
	if err != nil {
		// Профиль не существует, создаем новый
		profile = &models.UserProfile{
			UserID:    userID,
			Name:      req.Name,
			Email:     req.Email,
			Address:   req.Address,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if err := s.userRepo.CreateProfile(ctx, profile); err != nil {
			return nil, fmt.Errorf("не удалось создать профиль: %w", err)
		}
		return profile, nil
	}

	// Обновление существующего профиля
	profile.Name = req.Name
	profile.Email = req.Email
	profile.Address = req.Address
	profile.UpdatedAt = time.Now()

	if err := s.userRepo.UpdateProfile(ctx, profile); err != nil {
		return nil, fmt.Errorf("не удалось обновить профиль: %w", err)
	}

	return profile, nil
}

// GetUser получает пользователя по ID.
func (s *UserService) GetUser(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить пользователя: %w", err)
	}
	return user, nil
}
