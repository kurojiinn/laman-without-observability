package auth

import (
	"Laman/internal/models"
	"Laman/internal/observability"
	"Laman/internal/users"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"
)

var (
	ErrInvalidRole          = errors.New("invalid role")
	ErrUserAlreadyExists    = errors.New("user already exists")
	ErrRegistrationRequired = errors.New("registration required")
	ErrRoleRequired         = errors.New("role is required for new user")
	ErrCodeRequired         = errors.New("verification code is required")
)

// AuthService обрабатывает бизнес-логику, связанную с аутентификацией,
// включая верификацию телефона и генерацию JWT токенов.
type AuthService struct {
	authRepo    AuthRepository
	userRepo    UserRepository
	jwtSecret   string
	smsProvider SMSProvider
	logger      *zap.Logger
}

// UserRepository определяет интерфейс, необходимый из модуля users.
type UserRepository interface {
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	Create(ctx context.Context, user *models.User) error
}

// NewAuthService создает новый сервис аутентификации.
func NewAuthService(authRepo AuthRepository, userRepo UserRepository, jwtSecret string, smsProvider SMSProvider, logger *zap.Logger) *AuthService {
	if smsProvider == nil {
		smsProvider = NewNoopSMSProvider()
	}
	return &AuthService{
		authRepo:    authRepo,
		userRepo:    userRepo,
		jwtSecret:   jwtSecret,
		smsProvider: smsProvider,
		logger:      logger,
	}
}

// SendCodeRequest представляет запрос на отправку кода верификации.
type SendCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// RequestCodeRequest представляет запрос на генерацию OTP кода.
type RequestCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// VerifyCodeRequest представляет запрос на верификацию кода.
type VerifyCodeRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
}

// VerifyRequest представляет запрос на подтверждение OTP кода.
type VerifyRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
	Role  string `json:"role,omitempty"`
}

// RegisterRequest представляет запрос на регистрацию с выбором роли.
type RegisterRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code,omitempty"`
	Role  string `json:"role" binding:"required"`
}

// LoginRequest представляет запрос на вход по номеру телефона.
type LoginRequest struct {
	Phone string `json:"phone" binding:"required"`
}

// AuthResponse представляет ответ аутентификации.
type AuthResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// SendCode отправляет код верификации на номер телефона.
// В продакшене здесь будет интеграция с SMS-шлюзом.
func (s *AuthService) SendCode(ctx context.Context, req SendCodeRequest) error {
	ctx, span := observability.StartSpan(ctx, "auth.SendCode")
	defer span.End()
	start := time.Now()

	// Генерация 6-значного кода
	code, err := generateCode(6)
	if err != nil {
		authOperationTotal.WithLabelValues("send_code", "error").Inc()
		authOperationDuration.WithLabelValues("send_code").Observe(time.Since(start).Seconds())
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
		authOperationTotal.WithLabelValues("send_code", "error").Inc()
		authOperationDuration.WithLabelValues("send_code").Observe(time.Since(start).Seconds())
		return fmt.Errorf("не удалось создать код аутентификации: %w", err)
	}

	// В продакшене здесь отправка SMS
	// Для MVP просто выводим в лог (в продакшене использовать правильный логгер)
	fmt.Printf("Код верификации для %s: %s\n", req.Phone, code)
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(req.Phone)))
	authOperationTotal.WithLabelValues("send_code", "success").Inc()
	authOperationDuration.WithLabelValues("send_code").Observe(time.Since(start).Seconds())
	if s.logger != nil {
		s.logger.Info("Код верификации успешно создан", zap.String("phone", maskPhone(req.Phone)))
	}

	return nil
}

// RequestCode генерирует 4-значный код, сохраняет его в БД и отправляет через SMS.RU.
func (s *AuthService) RequestCode(ctx context.Context, req RequestCodeRequest) error {
	phone := normalizePhone(req.Phone)
	if phone == "" {
		return fmt.Errorf("номер телефона пустой после очистки")
	}

	ctx, span := observability.StartSpan(ctx, "auth.RequestCode")
	defer span.End()
	start := time.Now()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(phone)))

	if err := s.authRepo.InvalidateAuthCodesByPhone(ctx, phone); err != nil {
		authOperationTotal.WithLabelValues("request_code", "error").Inc()
		authOperationDuration.WithLabelValues("request_code").Observe(time.Since(start).Seconds())
		return fmt.Errorf("не удалось сбросить предыдущий код: %w", err)
	}

	code, err := s.smsProvider.RequestCode(ctx, phone)
	if err != nil {
		authOperationTotal.WithLabelValues("request_code", "error").Inc()
		authOperationDuration.WithLabelValues("request_code").Observe(time.Since(start).Seconds())
		return fmt.Errorf("не удалось запросить код подтверждения: %w", err)
	}

	authCode := &models.AuthCode{
		ID:        uuid.New(),
		Phone:     phone,
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute),
		Used:      false,
		CreatedAt: time.Now(),
	}

	if err := s.authRepo.CreateAuthCode(ctx, authCode); err != nil {
		authOperationTotal.WithLabelValues("request_code", "error").Inc()
		authOperationDuration.WithLabelValues("request_code").Observe(time.Since(start).Seconds())
		return fmt.Errorf("не удалось сохранить OTP код: %w", err)
	}

	authOperationTotal.WithLabelValues("request_code", "success").Inc()
	authOperationDuration.WithLabelValues("request_code").Observe(time.Since(start).Seconds())
	if s.logger != nil {
		s.logger.Info("OTP код отправлен пользователю", zap.String("phone", maskPhone(phone)))
	}
	return nil
}

// Register регистрирует нового пользователя с выбранной ролью и возвращает JWT токен.
func (s *AuthService) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	ctx, span := observability.StartSpan(ctx, "auth.Register")
	defer span.End()
	start := time.Now()

	role, err := normalizeRole(req.Role)
	if err != nil {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, err
	}
	span.SetAttributes(
		attribute.String("auth.role", role),
		attribute.String("auth.phone_masked", maskPhone(req.Phone)),
	)

	_, err = s.userRepo.GetByPhone(ctx, req.Phone)
	if err == nil {
		authOperationTotal.WithLabelValues("register", "conflict").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, ErrUserAlreadyExists
	}
	if !errors.Is(err, users.ErrUserNotFound) {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось проверить пользователя: %w", err)
	}

	verificationCode := strings.TrimSpace(req.Code)
	if verificationCode == "" {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, ErrCodeRequired
	}
	if err := s.verifyAndConsumeCode(ctx, req.Phone, verificationCode); err != nil {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, err
	}

	user := &models.User{
		ID:        uuid.New(),
		Phone:     req.Phone,
		Role:      role,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось создать пользователя: %w", err)
	}

	token, err := s.generateToken(user.ID)
	if err != nil {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}
	authOperationTotal.WithLabelValues("register", "success").Inc()
	authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
	if s.logger != nil {
		s.logger.Info("Пользователь зарегистрирован",
			zap.String("user_id", user.ID.String()),
			zap.String("role", user.Role),
			zap.String("phone", maskPhone(user.Phone)),
		)
	}

	return &AuthResponse{Token: token, User: user}, nil
}

// Login выполняет вход зарегистрированного пользователя и возвращает JWT токен.
func (s *AuthService) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	ctx, span := observability.StartSpan(ctx, "auth.Login")
	defer span.End()
	start := time.Now()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(req.Phone)))

	user, err := s.userRepo.GetByPhone(ctx, req.Phone)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			authOperationTotal.WithLabelValues("login", "registration_required").Inc()
			authOperationDuration.WithLabelValues("login").Observe(time.Since(start).Seconds())
			return nil, ErrRegistrationRequired
		}
		authOperationTotal.WithLabelValues("login", "error").Inc()
		authOperationDuration.WithLabelValues("login").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось получить пользователя: %w", err)
	}

	token, err := s.generateToken(user.ID)
	if err != nil {
		authOperationTotal.WithLabelValues("login", "error").Inc()
		authOperationDuration.WithLabelValues("login").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}

	authOperationTotal.WithLabelValues("login", "success").Inc()
	authOperationDuration.WithLabelValues("login").Observe(time.Since(start).Seconds())
	if s.logger != nil {
		s.logger.Info("Пользователь успешно вошел",
			zap.String("user_id", user.ID.String()),
			zap.String("role", user.Role),
		)
	}

	return &AuthResponse{Token: token, User: user}, nil
}

// VerifyCode верифицирует код и возвращает JWT токен для уже зарегистрированного пользователя.
func (s *AuthService) VerifyCode(ctx context.Context, req VerifyCodeRequest) (*AuthResponse, error) {
	ctx, span := observability.StartSpan(ctx, "auth.VerifyCode")
	defer span.End()
	start := time.Now()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(req.Phone)))

	user, err := s.userRepo.GetByPhone(ctx, req.Phone)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			authOperationTotal.WithLabelValues("verify_code", "registration_required").Inc()
			authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
			return nil, ErrRegistrationRequired
		}
		authOperationTotal.WithLabelValues("verify_code", "error").Inc()
		authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось получить пользователя: %w", err)
	}

	if err := s.verifyAndConsumeCode(ctx, req.Phone, req.Code); err != nil {
		authOperationTotal.WithLabelValues("verify_code", "error").Inc()
		authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
		return nil, err
	}

	token, err := s.generateToken(user.ID)
	if err != nil {
		authOperationTotal.WithLabelValues("verify_code", "error").Inc()
		authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}
	authOperationTotal.WithLabelValues("verify_code", "success").Inc()
	authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
	if s.logger != nil {
		s.logger.Info("Пользователь успешно аутентифицирован",
			zap.String("user_id", user.ID.String()),
			zap.String("role", user.Role),
		)
	}

	return &AuthResponse{Token: token, User: user}, nil
}

// Verify подтверждает OTP-код и возвращает JWT; при отсутствии пользователя создает его по роли.
func (s *AuthService) Verify(ctx context.Context, req VerifyRequest) (*AuthResponse, error) {
	phone := normalizePhone(req.Phone)
	if phone == "" {
		return nil, fmt.Errorf("номер телефона пустой после очистки")
	}

	ctx, span := observability.StartSpan(ctx, "auth.Verify")
	defer span.End()
	start := time.Now()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(phone)))

	if err := s.verifyAndConsumeCode(ctx, phone, req.Code); err != nil {
		authOperationTotal.WithLabelValues("verify", "error").Inc()
		authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
		return nil, err
	}

	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		if !errors.Is(err, users.ErrUserNotFound) {
			authOperationTotal.WithLabelValues("verify", "error").Inc()
			authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
			return nil, fmt.Errorf("не удалось получить пользователя: %w", err)
		}

		if strings.TrimSpace(req.Role) == "" {
			authOperationTotal.WithLabelValues("verify", "error").Inc()
			authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
			return nil, ErrRoleRequired
		}

		role, roleErr := normalizeRole(req.Role)
		if roleErr != nil {
			authOperationTotal.WithLabelValues("verify", "error").Inc()
			authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
			return nil, roleErr
		}

		user = &models.User{
			ID:        uuid.New(),
			Phone:     phone,
			Role:      role,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if createErr := s.userRepo.Create(ctx, user); createErr != nil {
			authOperationTotal.WithLabelValues("verify", "error").Inc()
			authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
			return nil, fmt.Errorf("не удалось создать пользователя: %w", createErr)
		}
	}

	token, err := s.generateToken(user.ID)
	if err != nil {
		authOperationTotal.WithLabelValues("verify", "error").Inc()
		authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}

	authOperationTotal.WithLabelValues("verify", "success").Inc()
	authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
	return &AuthResponse{Token: token, User: user}, nil
}

// GetUserByID возвращает пользователя по идентификатору для auth/me.
func (s *AuthService) GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	ctx, span := observability.StartSpan(ctx, "auth.GetUserByID")
	defer span.End()
	span.SetAttributes(attribute.String("auth.user_id", userID.String()))
	return s.userRepo.GetByID(ctx, userID)
}

// verifyAndConsumeCode проверяет одноразовый код и помечает его как использованный.
func (s *AuthService) verifyAndConsumeCode(ctx context.Context, phone, code string) error {
	ctx, span := observability.StartSpan(ctx, "auth.verifyAndConsumeCode")
	defer span.End()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(phone)))

	authCode, err := s.authRepo.GetAuthCodeByPhoneAndCode(ctx, phone, code)
	if err != nil {
		return fmt.Errorf("неверный или истекший код: %w", err)
	}

	if err := s.authRepo.MarkAuthCodeAsUsed(ctx, authCode.ID); err != nil {
		return fmt.Errorf("не удалось пометить код как использованный: %w", err)
	}

	return nil
}

// normalizeRole нормализует роль к верхнему регистру и валидирует допустимые значения.
func normalizeRole(role string) (string, error) {
	normalized := strings.ToUpper(strings.TrimSpace(role))
	if !models.IsValidUserRole(normalized) {
		return "", ErrInvalidRole
	}
	return normalized, nil
}

// maskPhone скрывает часть номера телефона для безопасного логирования и трейсинга.
func maskPhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if len(phone) <= 4 {
		return "****"
	}
	return phone[:2] + "****" + phone[len(phone)-2:]
}

// normalizePhone удаляет все символы, кроме цифр.
func normalizePhone(phone string) string {
	var out strings.Builder
	out.Grow(len(phone))
	for _, r := range phone {
		if unicode.IsDigit(r) {
			out.WriteRune(r)
		}
	}
	return out.String()
}

// generateToken генерирует JWT токен для пользователя.
func (s *AuthService) generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
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
