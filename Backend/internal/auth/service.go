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
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidRole          = errors.New("invalid role")
	ErrUserAlreadyExists    = errors.New("user already exists")
	ErrRegistrationRequired = errors.New("registration required")
	ErrRoleRequired         = errors.New("role is required for new user")
	ErrCodeRequired         = errors.New("verification code is required")
	ErrOTPBlocked           = errors.New("too many otp attempts")
	ErrEmailNotVerified     = errors.New("email not verified")

	// ErrTokenRevoked возвращается ValidateToken когда токен был явно отозван через Logout.
	//
	// Почему отдельный sentinel error, а не просто "неверный токен":
	//   - Клиент может отличить "токен просрочен/неверен" от "вы были разлогинены"
	//   - Фронтенд может показать сообщение "Вы вышли из другого устройства"
	//   - Упрощает тестирование: errors.Is(err, ErrTokenRevoked)
	ErrTokenRevoked = errors.New("token has been revoked")
)

// AuthService обрабатывает бизнес-логику, связанную с аутентификацией,
// включая верификацию телефона и генерацию JWT токенов.
type AuthService struct {
	authRepo        AuthRepository
	userRepo        UserRepository
	jwtSecret       string
	smsProvider     SMSProvider
	emailSender     EmailSender
	otpLimiter      OTPLimiter   // лимит попыток ввода кода (verify-code)
	sendCodeLimiter OTPLimiter   // лимит запросов на отправку SMS (request-code)
	revoker         TokenRevoker // блэклист отозванных JWT (logout)
	logger          *zap.Logger
	devMode         bool        // если true — OTP выводится в логи и Telegram
	otpNotifier     OTPNotifier // опционально: отправляет OTP в Telegram в dev-режиме
}

// OTPNotifier отправляет OTP-код во внешний канал (например, Telegram).
type OTPNotifier interface {
	NotifyOTP(ctx context.Context, phone, code string) error
}

// UserRepository определяет интерфейс, необходимый из модуля users.
type UserRepository interface {
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	UpdateEmailVerified(ctx context.Context, userID uuid.UUID) error
	Create(ctx context.Context, user *models.User) error
}

// NewAuthService создает новый сервис аутентификации.
//
// Если otpLimiter == nil — используется NoopOTPLimiter (без ограничений).
// Это позволяет сервису работать без Redis, что удобно в тестах и dev-окружении.
// Паттерн "optional dependency with safe default" — используется в большинстве
// Go-библиотек (например, zap.Logger по умолчанию noop если не передан).
// NewAuthService создаёт сервис аутентификации.
//
//   - otpLimiter      — лимитер попыток ввода кода (verify-code), рекомендуется 5/15m
//   - sendCodeLimiter — лимитер запросов на отправку SMS (request-code), рекомендуется 3/10m
//
// Оба лимитера могут быть nil — тогда используются NoopOTPLimiter (без ограничений).
// Это удобно в тестах и dev-окружении без Redis.
func NewAuthService(authRepo AuthRepository, userRepo UserRepository, jwtSecret string, smsProvider SMSProvider, emailSender EmailSender, logger *zap.Logger, otpLimiter OTPLimiter, sendCodeLimiter OTPLimiter, revoker TokenRevoker, devMode bool, otpNotifier OTPNotifier) *AuthService {
	if smsProvider == nil {
		smsProvider = NewNoopSMSProvider(logger)
	}
	if emailSender == nil {
		emailSender = &NoopEmailSender{logger: logger}
	}
	if otpLimiter == nil {
		otpLimiter = NewNoopOTPLimiter()
	}
	if sendCodeLimiter == nil {
		sendCodeLimiter = NewNoopOTPLimiter()
	}
	if revoker == nil {
		revoker = NewNoopTokenRevoker()
	}
	return &AuthService{
		authRepo:        authRepo,
		userRepo:        userRepo,
		jwtSecret:       jwtSecret,
		smsProvider:     smsProvider,
		emailSender:     emailSender,
		otpLimiter:      otpLimiter,
		sendCodeLimiter: sendCodeLimiter,
		revoker:         revoker,
		logger:          logger,
		devMode:         devMode,
		otpNotifier:     otpNotifier,
	}
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
}

// RegisterRequest представляет запрос на регистрацию нового пользователя.
type RegisterRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code,omitempty"`
}

// AuthResponse представляет ответ аутентификации.
type AuthResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// CheckUserExists проверяет, зарегистрирован ли пользователь с данным номером телефона.
// Не отправляет OTP — используется для проверки перед регистрацией/входом.
func (s *AuthService) CheckUserExists(ctx context.Context, phone string) (bool, error) {
	phone = normalizePhone(phone)
	if phone == "" {
		return false, fmt.Errorf("номер телефона пустой после очистки")
	}
	_, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("ошибка поиска пользователя: %w", err)
	}
	return true, nil
}

// RequestCode генерирует OTP-код, сохраняет его в БД и отправляет через SMS.RU.
// Ограничивает число запросов через sendCodeLimiter — защита от SMS-флуда.
func (s *AuthService) RequestCode(ctx context.Context, req RequestCodeRequest) error {
	phone := normalizePhone(req.Phone)
	if phone == "" {
		return fmt.Errorf("номер телефона пустой после очистки")
	}

	ctx, span := observability.StartSpan(ctx, "auth.RequestCode")
	defer span.End()
	start := time.Now()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(phone)))

	// Проверяем лимит отправки SMS до любых других операций.
	// Это защищает от SMS-флуда: злоумышленник не сможет расходовать SMS-баланс.
	_, blocked, limiterErr := s.sendCodeLimiter.CheckAndIncrement(ctx, phone)
	if limiterErr != nil && s.logger != nil {
		s.logger.Warn("sendCodeLimiter недоступен, пропускаем проверку", zap.Error(limiterErr), zap.String("phone", maskPhone(phone)))
	}
	if blocked {
		authOperationTotal.WithLabelValues("request_code", "blocked").Inc()
		authOperationDuration.WithLabelValues("request_code").Observe(time.Since(start).Seconds())
		return ErrOTPBlocked
	}

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
		fields := []zap.Field{zap.String("phone", maskPhone(phone))}
		if s.devMode {
			fields = append(fields, zap.String("dev_otp", code))
		}
		s.logger.Info("OTP код отправлен пользователю", fields...)
	}
	if s.devMode && s.otpNotifier != nil {
		if err := s.otpNotifier.NotifyOTP(ctx, phone, code); err != nil && s.logger != nil {
			s.logger.Warn("Не удалось отправить OTP в Telegram", zap.Error(err))
		}
	}
	return nil
}

// Register регистрирует нового пользователя с выбранной ролью и возвращает JWT токен.
func (s *AuthService) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	ctx, span := observability.StartSpan(ctx, "auth.Register")
	defer span.End()
	start := time.Now()

	phone := normalizePhone(req.Phone)
	if phone == "" {
		return nil, fmt.Errorf("номер телефона пустой после очистки")
	}

	role := models.UserRoleClient
	span.SetAttributes(
		attribute.String("auth.role", role),
		attribute.String("auth.phone_masked", maskPhone(phone)),
	)

	_, err := s.userRepo.GetByPhone(ctx, phone)
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
	if err := s.verifyAndConsumeCode(ctx, phone, verificationCode); err != nil {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, err
	}

	user := &models.User{
		ID:        uuid.New(),
		Phone:     phone,
		Role:      role,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		authOperationTotal.WithLabelValues("register", "error").Inc()
		authOperationDuration.WithLabelValues("register").Observe(time.Since(start).Seconds())
		return nil, fmt.Errorf("не удалось создать пользователя: %w", err)
	}

	token, err := s.generateToken(user.ID, user.Role)
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

// VerifyCode верифицирует код и возвращает JWT токен для уже зарегистрированного пользователя.
func (s *AuthService) VerifyCode(ctx context.Context, req VerifyCodeRequest) (*AuthResponse, error) {
	ctx, span := observability.StartSpan(ctx, "auth.VerifyCode")
	defer span.End()
	start := time.Now()
	span.SetAttributes(attribute.String("auth.phone_masked", maskPhone(req.Phone)))

	// Та же логика что в Verify — сначала лимит, потом проверка кода.
	phone := normalizePhone(req.Phone)
	if phone == "" {
		return nil, fmt.Errorf("номер телефона пустой после очистки")
	}
	_, blocked, limiterErr := s.otpLimiter.CheckAndIncrement(ctx, phone)
	if limiterErr != nil && s.logger != nil {
		s.logger.Warn("OTPLimiter недоступен, пропускаем проверку", zap.Error(limiterErr), zap.String("phone", maskPhone(phone)))
	}
	if blocked {
		authOperationTotal.WithLabelValues("verify_code", "blocked").Inc()
		authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
		return nil, ErrOTPBlocked
	}

	user, err := s.userRepo.GetByPhone(ctx, phone)
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

	if err := s.verifyAndConsumeCode(ctx, phone, req.Code); err != nil {
		authOperationTotal.WithLabelValues("verify_code", "error").Inc()
		authOperationDuration.WithLabelValues("verify_code").Observe(time.Since(start).Seconds())
		return nil, err
	}

	// Сбрасываем счётчик только при успехе.
	if err := s.otpLimiter.Reset(ctx, phone); err != nil && s.logger != nil {
		s.logger.Warn("не удалось сбросить счётчик OTP", zap.Error(err), zap.String("phone", maskPhone(phone)))
	}

	token, err := s.generateToken(user.ID, user.Role)
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

	// Проверяем лимит попыток ДО верификации кода.
	//
	// Порядок важен: если сначала проверить код а потом лимит —
	// злоумышленник узнает что код верный (получит успех) и обойдёт блокировку.
	// Сначала лимит — потом код. Именно так реализовано в Twilio Verify.
	//
	// Graceful degradation: если Redis недоступен (err != nil) —
	// логируем предупреждение, но продолжаем. Лучше пропустить атаку
	// в момент падения Redis, чем заблокировать всех пользователей.
	_, blocked, limiterErr := s.otpLimiter.CheckAndIncrement(ctx, phone)
	if limiterErr != nil && s.logger != nil {
		s.logger.Warn("OTPLimiter недоступен, пропускаем проверку", zap.Error(limiterErr), zap.String("phone", maskPhone(phone)))
	}
	if blocked {
		authOperationTotal.WithLabelValues("verify", "blocked").Inc()
		authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
		return nil, ErrOTPBlocked
	}

	if err := s.verifyAndConsumeCode(ctx, phone, req.Code); err != nil {
		authOperationTotal.WithLabelValues("verify", "error").Inc()
		authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
		return nil, err
	}

	// Сбрасываем счётчик только при успешной верификации.
	// Ошибку Reset не возвращаем пользователю — он уже прошёл верификацию.
	if err := s.otpLimiter.Reset(ctx, phone); err != nil && s.logger != nil {
		s.logger.Warn("не удалось сбросить счётчик OTP", zap.Error(err), zap.String("phone", maskPhone(phone)))
	}

	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		if !errors.Is(err, users.ErrUserNotFound) {
			authOperationTotal.WithLabelValues("verify", "error").Inc()
			authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
			return nil, fmt.Errorf("не удалось получить пользователя: %w", err)
		}

		// Публичный эндпоинт всегда создаёт только CLIENT — роль не принимается от клиента.
		user = &models.User{
			ID:        uuid.New(),
			Phone:     phone,
			Role:      models.UserRoleClient,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		if createErr := s.userRepo.Create(ctx, user); createErr != nil {
			authOperationTotal.WithLabelValues("verify", "error").Inc()
			authOperationDuration.WithLabelValues("verify").Observe(time.Since(start).Seconds())
			return nil, fmt.Errorf("не удалось создать пользователя: %w", createErr)
		}
	}

	token, err := s.generateToken(user.ID, user.Role)
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
//
// Добавляем `jti` (JWT ID) — уникальный идентификатор конкретного токена.
// Именно по нему работает механизм отзыва: при logout JTI сохраняется
// в Redis-блэклисте. ValidateToken проверяет не отозван ли этот JTI.
//
// Без JTI нельзя различить два токена одного пользователя —
// нельзя отозвать "только этот логин", пришлось бы отзывать все сразу.
func (s *AuthService) generateToken(userID uuid.UUID, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"role":    role,
		"jti":     uuid.New().String(), // уникальный ID токена — для механизма отзыва
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// ValidateToken валидирует JWT токен и возвращает ID пользователя и его роль.
//
// Принимает context — нужен для обращения к Redis (проверка блэклиста).
// Без context нельзя передать deadline запроса и соблюдать timeout.
func (s *AuthService) ValidateToken(ctx context.Context, tokenString string) (uuid.UUID, string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи: %v", token.Header["alg"])
		}
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return uuid.Nil, "", fmt.Errorf("неверный токен: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return uuid.Nil, "", fmt.Errorf("неверный токен")
	}

	// Проверяем блэклист по JTI.
	//
	// Graceful degradation: если Redis упал — логируем предупреждение и пропускаем проверку.
	// Лучше пропустить отозванный токен в момент недоступности Redis,
	// чем заблокировать ВСЕХ пользователей. Мониторинг Redis — отдельная задача.
	jti, _ := claims["jti"].(string)
	if jti != "" {
		revoked, revokeErr := s.revoker.IsRevoked(ctx, jti)
		if revokeErr != nil && s.logger != nil {
			s.logger.Warn("token revoker недоступен, пропускаем проверку блэклиста", zap.Error(revokeErr))
		}
		if revoked {
			return uuid.Nil, "", ErrTokenRevoked
		}
	}

	userIDStr, ok := claims["user_id"].(string)
	if !ok {
		return uuid.Nil, "", fmt.Errorf("неверные claims токена")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("неверный ID пользователя в токене: %w", err)
	}
	role, _ := claims["role"].(string)
	return userID, role, nil
}

// Logout отзывает токен — добавляет его JTI в Redis-блэклист.
//
// TTL блэклист-записи = оставшееся время жизни токена.
// Когда токен сам по себе истечёт — запись в Redis удалится автоматически.
// Это предотвращает неограниченный рост блэклиста.
func (s *AuthService) Logout(ctx context.Context, tokenString string) error {
	// Парсим без проверки expiry — просроченный токен тоже нужно занести в блэклист
	// (или убедиться что он уже истёк и добавлять не нужно).
	// Невалидная подпись — токен не наш, молча игнорируем.
	parser := jwt.NewParser(jwt.WithoutClaimsValidation())
	token, err := parser.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи")
		}
		return []byte(s.jwtSecret), nil
	})
	if err != nil {
		// Подпись не прошла — токен чужой или мусор, считаем разлогиненным
		return nil
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return fmt.Errorf("неверные claims токена")
	}

	jti, _ := claims["jti"].(string)
	if jti == "" {
		// Старый токен без JTI (выдан до этого изменения) — просто игнорируем.
		// Такие токены истекут сами через 24 часа.
		return nil
	}

	// Вычисляем оставшееся время жизни токена.
	exp, _ := claims["exp"].(float64)
	ttl := time.Until(time.Unix(int64(exp), 0))
	if ttl <= 0 {
		// Токен уже истёк — добавлять в блэклист бессмысленно.
		return nil
	}

	return s.revoker.Revoke(ctx, jti, ttl)
}

// ── Email-авторизация ─────────────────────────────────────────────────────────

// RegisterWithEmailRequest представляет запрос на регистрацию по email.
type RegisterWithEmailRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// VerifyEmailRequest представляет запрос на подтверждение email-кода.
type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
}

// LoginWithEmailRequest представляет запрос на вход по email + пароль.
type LoginWithEmailRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// RegisterWithEmail создаёт пользователя с email и паролем и отправляет OTP для подтверждения.
// Если пользователь существует, но ещё не подтвердил email — повторно отправляет код.
func (s *AuthService) RegisterWithEmail(ctx context.Context, req RegisterWithEmailRequest) error {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	existingUser, err := s.userRepo.GetByEmail(ctx, email)
	if err == nil {
		if existingUser.EmailVerified {
			return ErrUserAlreadyExists
		}
		// Не подтверждён — повторно отправляем OTP
		return s.sendEmailOTP(ctx, email)
	}
	if !errors.Is(err, users.ErrUserNotFound) {
		return fmt.Errorf("ошибка проверки email: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("ошибка хеширования пароля: %w", err)
	}
	hashStr := string(hash)

	user := &models.User{
		ID:           uuid.New(),
		Phone:        "",
		Email:        &email,
		Role:         models.UserRoleClient,
		PasswordHash: &hashStr,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return fmt.Errorf("не удалось создать пользователя: %w", err)
	}

	return s.sendEmailOTP(ctx, email)
}

// sendEmailOTP генерирует и отправляет OTP-код на email.
func (s *AuthService) sendEmailOTP(ctx context.Context, email string) error {
	_ = s.authRepo.InvalidateAuthCodesByEmail(ctx, email)

	code, err := generateCode(4)
	if err != nil {
		return fmt.Errorf("ошибка генерации кода: %w", err)
	}

	authCode := &models.AuthCode{
		ID:        uuid.New(),
		Phone:     "",
		Email:     &email,
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute),
		Used:      false,
		CreatedAt: time.Now(),
	}
	if err := s.authRepo.CreateAuthCode(ctx, authCode); err != nil {
		return fmt.Errorf("не удалось сохранить OTP: %w", err)
	}

	if s.logger != nil {
		if s.devMode {
			s.logger.Info("[EMAIL] OTP отправлен", zap.String("email", maskEmail(email)), zap.String("dev_otp", code))
		} else {
			s.logger.Info("[EMAIL] OTP отправлен", zap.String("email", maskEmail(email)))
		}
	}

	if err := s.emailSender.SendOTP(ctx, email, code); err != nil {
		if s.logger != nil {
			s.logger.Warn("не удалось отправить OTP на email", zap.Error(err))
		}
		if !s.devMode {
			return fmt.Errorf("не удалось отправить письмо: %w", err)
		}
	}
	return nil
}

// VerifyEmail подтверждает email-код и возвращает JWT.
func (s *AuthService) VerifyEmail(ctx context.Context, req VerifyEmailRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	_, blocked, _ := s.otpLimiter.CheckAndIncrement(ctx, "email:"+email)
	if blocked {
		return nil, ErrOTPBlocked
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("пользователь не найден")
	}

	authCode, err := s.authRepo.GetAuthCodeByEmailAndCode(ctx, email, req.Code)
	if err != nil {
		return nil, fmt.Errorf("неверный или истёкший код")
	}
	if err := s.authRepo.MarkAuthCodeAsUsed(ctx, authCode.ID); err != nil {
		return nil, fmt.Errorf("ошибка подтверждения: %w", err)
	}

	if err := s.userRepo.UpdateEmailVerified(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("ошибка обновления статуса: %w", err)
	}
	user.EmailVerified = true

	_ = s.otpLimiter.Reset(ctx, "email:"+email)

	token, err := s.generateToken(user.ID, user.Role)
	if err != nil {
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}

	if s.logger != nil {
		s.logger.Info("Email подтверждён, пользователь авторизован",
			zap.String("user_id", user.ID.String()),
		)
	}
	return &AuthResponse{Token: token, User: user}, nil
}

// LoginWithEmail авторизует пользователя по email и паролю.
func (s *AuthService) LoginWithEmail(ctx context.Context, req LoginWithEmailRequest) (*AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("неверный email или пароль")
	}

	if !user.EmailVerified {
		return nil, ErrEmailNotVerified
	}

	if user.PasswordHash == nil {
		return nil, fmt.Errorf("неверный email или пароль")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("неверный email или пароль")
	}

	token, err := s.generateToken(user.ID, user.Role)
	if err != nil {
		return nil, fmt.Errorf("не удалось сгенерировать токен: %w", err)
	}

	if s.logger != nil {
		s.logger.Info("Пользователь авторизован по email", zap.String("user_id", user.ID.String()))
	}
	return &AuthResponse{Token: token, User: user}, nil
}

// CheckEmailExists проверяет, зарегистрирован ли пользователь с данным email.
func (s *AuthService) CheckEmailExists(ctx context.Context, email string) (bool, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	_, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, users.ErrUserNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("ошибка поиска пользователя: %w", err)
	}
	return true, nil
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
