package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"
	"Laman/internal/models"
	"Laman/internal/users"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// AuthService обрабатывает бизнес-логику, связанную с аутентификацией,
// включая верификацию телефона и генерацию JWT токенов.
type AuthService struct {
	authRepo AuthRepository
	userRepo UserRepository
	jwtSecret string
}

// UserRepository определяет интерфейс, необходимый из модуля users.
type UserRepository interface {
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	Create(ctx context.Context, user *models.User) error
}

// NewAuthService создает новый сервис аутентификации.
func NewAuthService(authRepo AuthRepository, userRepo UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		authRepo:  authRepo,
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

// SendCodeRequest представляет запрос на отправку кода верификации.
type SendCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// VerifyCodeRequest представляет запрос на верификацию кода.
type VerifyCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
}

// AuthResponse представляет ответ аутентификации.
type AuthResponse struct {
	Token string      `json:"token"`
	User  *models.User `json:"user"`
}

// SendCode отправляет код верификации на номер телефона.
// В продакшене здесь будет интеграция с SMS-шлюзом.
func (s *AuthService) SendCode(ctx context.Context, req SendCodeRequest) error {
	// Генерация 6-значного кода
	code, err := generateCode(6)
	if err != nil {
		return fmt.Errorf("не удалось сгенерировать код: %w", err)
	}

	// Создание записи кода аутентификации
	authCode := &models.AuthCode{
		ID:        uuid.New(),
		Phone:     req.Phone,
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute), // Код истекает через 5 минут
		Used:      false,
		CreatedAt: time.Now(),
	}

	if err := s.authRepo.CreateAuthCode(ctx, authCode); err != nil {
		return fmt.Errorf("не удалось создать код аутентификации: %w", err)
	}

	// В продакшене здесь отправка SMS
	// Для MVP просто выводим в лог (в продакшене использовать правильный логгер)
	fmt.Printf("Код верификации для %s: %s\n", req.Phone, code)

	return nil
}

// VerifyCode верифицирует код и возвращает JWT токен.
func (s *AuthService) VerifyCode(ctx context.Context, req VerifyCodeRequest) (*AuthResponse, error) {
	// Получение кода аутентификации
	authCode, err := s.authRepo.GetAuthCodeByPhoneAndCode(ctx, req.Phone, req.Code)
	if err != nil {
		return nil, fmt.Errorf("неверный или истекший код: %w", err)
	}

	// Помечаем код как использованный
	if err := s.authRepo.MarkAuthCodeAsUsed(ctx, authCode.ID); err != nil {
		return nil, fmt.Errorf("не удалось пометить код как использованный: %w", err)
	}

	// Получение или создание пользователя
	user, err := s.userRepo.GetByPhone(ctx, req.Phone)
	if err != nil {
		if !errors.Is(err, users.ErrUserNotFound) {
			return nil, fmt.Errorf("не удалось получить пользователя: %w", err)
		}
		// Пользователь не существует, создаем нового
		user = &models.User{
			ID:        uuid.New(),
			Phone:     req.Phone,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, fmt.Errorf("не удалось создать пользователя: %w", err)
		}
	}

	// Генерация JWT токена
	token, err := s.generateToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}

	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

// generateToken генерирует JWT токен для пользователя.
func (s *AuthService) generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// ValidateToken валидирует JWT токен и возвращает ID пользователя.
func (s *AuthService) ValidateToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return uuid.Nil, fmt.Errorf("неверный токен: %w", err)
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userIDStr, ok := claims["user_id"].(string)
		if !ok {
			return uuid.Nil, fmt.Errorf("неверные claims токена")
		}
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			return uuid.Nil, fmt.Errorf("неверный ID пользователя в токене: %w", err)
		}
		return userID, nil
	}

	return uuid.Nil, fmt.Errorf("неверный токен")
}

// generateCode генерирует случайный числовой код указанной длины.
func generateCode(length int) (string, error) {
	max := big.NewInt(10)
	max.Exp(max, big.NewInt(int64(length)), nil)
	
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	
	code := fmt.Sprintf("%0*d", length, n)
	return code, nil
}
