package auth

import (
	"Laman/internal/models"
	"context"
	"github.com/google/uuid"
)

// AuthRepository определяет интерфейс для доступа к данным аутентификации.
type AuthRepository interface {
	// CreateAuthCode создает новый OTP-код (phone или email).
	CreateAuthCode(ctx context.Context, code *models.AuthCode) error

	// GetAuthCodeByPhoneAndCode получает код аутентификации по телефону и коду.
	GetAuthCodeByPhoneAndCode(ctx context.Context, phone, code string) (*models.AuthCode, error)

	// GetAuthCodeByEmailAndCode получает код аутентификации по email и коду.
	GetAuthCodeByEmailAndCode(ctx context.Context, email, code string) (*models.AuthCode, error)

	// MarkAuthCodeAsUsed помечает код аутентификации как использованный.
	MarkAuthCodeAsUsed(ctx context.Context, id uuid.UUID) error

	// InvalidateAuthCodesByPhone помечает предыдущие коды номера как использованные.
	InvalidateAuthCodesByPhone(ctx context.Context, phone string) error

	// InvalidateAuthCodesByEmail помечает предыдущие email-коды как использованные.
	InvalidateAuthCodesByEmail(ctx context.Context, email string) error
}
