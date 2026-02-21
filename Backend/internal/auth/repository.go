package auth

import (
	"context"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// AuthRepository определяет интерфейс для доступа к данным аутентификации.
type AuthRepository interface {
	// CreateAuthCode создает новый код аутентификации для верификации телефона.
	CreateAuthCode(ctx context.Context, code *models.AuthCode) error
	
	// GetAuthCodeByPhoneAndCode получает код аутентификации по телефону и коду.
	GetAuthCodeByPhoneAndCode(ctx context.Context, phone, code string) (*models.AuthCode, error)
	
	// MarkAuthCodeAsUsed помечает код аутентификации как использованный.
	MarkAuthCodeAsUsed(ctx context.Context, id uuid.UUID) error
}
