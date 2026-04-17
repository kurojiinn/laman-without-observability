package auth

import (
	"Laman/internal/middleware"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const authCookieName = "auth_token"
const authCookieMaxAge = 24 * 60 * 60 // 24 часа — совпадает с JWT expiry

// Handler обрабатывает HTTP запросы для аутентификации.
type Handler struct {
	authService  *AuthService
	logger       *zap.Logger
	cookieSecure bool
}

// NewHandler создает новый обработчик аутентификации.
func NewHandler(authService *AuthService, logger *zap.Logger, cookieSecure bool) *Handler {
	return &Handler{
		authService:  authService,
		logger:       logger,
		cookieSecure: cookieSecure,
	}
}

func (h *Handler) setAuthCookie(c *gin.Context, token string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     authCookieName,
		Value:    token,
		MaxAge:   authCookieMaxAge,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(24 * time.Hour),
	})
}

func (h *Handler) clearAuthCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		MaxAge:   -1,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

// RegisterRoutes регистрирует маршруты аутентификации.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	auth := router.Group("/auth")
	{
		auth.POST("/request-code", h.RequestCode)
		auth.POST("/verify", h.Verify)
		auth.POST("/send-code", h.SendCode)
		auth.POST("/verify-code", h.VerifyCode)
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
		auth.GET("/me", middleware.AuthMiddleware(h.authService), h.GetMe)
		auth.POST("/logout", middleware.AuthMiddleware(h.authService), h.Logout)
	}
}

// RequestCode обрабатывает POST /auth/request-code.
func (h *Handler) RequestCode(c *gin.Context) {
	var req RequestCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.RequestCode(c.Request.Context(), req); err != nil {
		if errors.Is(err, ErrSMSRateLimited) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Пожалуйста, подождите 60 секунд перед повторным звонком"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "код отправлен"})
}

// Verify обрабатывает POST /auth/verify.
func (h *Handler) Verify(c *gin.Context) {
	var req VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authService.Verify(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrOTPBlocked):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Слишком много попыток. Попробуйте через 15 минут"})
		case errors.Is(err, ErrInvalidRole):
			c.JSON(http.StatusBadRequest, gin.H{"error": "недопустимая роль"})
		case errors.Is(err, ErrRoleRequired):
			c.JSON(http.StatusBadRequest, gin.H{"error": "для нового пользователя требуется role"})
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		}
		return
	}

	h.setAuthCookie(c, resp.Token)
	c.JSON(http.StatusOK, resp)
}

// SendCode обрабатывает POST /auth/send-code
func (h *Handler) SendCode(c *gin.Context) {
	start := c.Request.Context()
	var req SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if h.logger != nil {
			h.logger.Warn("Некорректный запрос send-code", zap.Error(err))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.SendCode(start, req); err != nil {
		if h.logger != nil {
			h.logger.Error("Ошибка отправки кода верификации", zap.Error(err), zap.String("phone", maskPhone(req.Phone)))
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if h.logger != nil {
		h.logger.Info("Запрос send-code успешно обработан", zap.String("phone", maskPhone(req.Phone)))
	}

	c.JSON(http.StatusOK, gin.H{"message": "код верификации отправлен"})
}

// VerifyCode обрабатывает POST /auth/verify-code
func (h *Handler) VerifyCode(c *gin.Context) {
	var req VerifyCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if h.logger != nil {
			h.logger.Warn("Некорректный запрос verify-code", zap.Error(err))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.authService.VerifyCode(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrOTPBlocked):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Слишком много попыток. Попробуйте через 15 минут"})
		case errors.Is(err, ErrRegistrationRequired):
			if h.logger != nil {
				h.logger.Info("Попытка логина без регистрации", zap.String("phone", maskPhone(req.Phone)))
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "пользователь не зарегистрирован, используйте /auth/register"})
		default:
			if h.logger != nil {
				h.logger.Warn("Ошибка verify-code", zap.Error(err), zap.String("phone", maskPhone(req.Phone)))
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		}
		return
	}
	if h.logger != nil {
		h.logger.Info("Запрос verify-code успешно обработан", zap.String("user_id", response.User.ID.String()))
	}

	h.setAuthCookie(c, response.Token)
	c.JSON(http.StatusCreated, response)
}

// Register обрабатывает POST /auth/register.
func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if h.logger != nil {
			h.logger.Warn("Некорректный запрос register", zap.Error(err))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.authService.Register(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidRole):
			if h.logger != nil {
				h.logger.Warn("Регистрация отклонена: недопустимая роль", zap.String("role", req.Role), zap.String("phone", maskPhone(req.Phone)))
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "недопустимая роль, используйте CLIENT, COURIER или PICKER"})
		case errors.Is(err, ErrCodeRequired):
			if h.logger != nil {
				h.logger.Warn("Регистрация отклонена: отсутствует код подтверждения", zap.String("phone", maskPhone(req.Phone)))
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "для регистрации требуется код подтверждения"})
		case errors.Is(err, ErrUserAlreadyExists):
			if h.logger != nil {
				h.logger.Info("Регистрация отклонена: пользователь уже существует", zap.String("phone", maskPhone(req.Phone)))
			}
			c.JSON(http.StatusConflict, gin.H{"error": "пользователь уже зарегистрирован"})
		default:
			if h.logger != nil {
				h.logger.Warn("Ошибка регистрации пользователя", zap.Error(err), zap.String("phone", maskPhone(req.Phone)))
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		}
		return
	}
	if h.logger != nil {
		h.logger.Info("Запрос register успешно обработан",
			zap.String("user_id", response.User.ID.String()),
			zap.String("role", response.User.Role),
		)
	}

	h.setAuthCookie(c, response.Token)
	c.JSON(http.StatusOK, response)
}

// Login обрабатывает POST /auth/login.
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if h.logger != nil {
			h.logger.Warn("Некорректный запрос login", zap.Error(err))
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		if errors.Is(err, ErrRegistrationRequired) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "пользователь не зарегистрирован, используйте /auth/register"})
			return
		}
		if errors.Is(err, ErrOTPBlocked) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Слишком много попыток. Попробуйте позже"})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	h.setAuthCookie(c, response.Token)
	c.JSON(http.StatusOK, response)
}

// Logout handles POST /auth/logout.
func (h *Handler) Logout(c *gin.Context) {
	// Пробуем отозвать токен из заголовка (iOS/picker) или из cookie (web).
	authHeader := c.GetHeader("Authorization")
	var token string
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 {
			token = parts[1]
		}
	} else if cookie, err := c.Cookie(authCookieName); err == nil {
		token = cookie
	}

	if token != "" {
		if err := h.authService.Logout(c.Request.Context(), token); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось выйти"})
			return
		}
	}

	h.clearAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"message": "успешный выход"})
}

// GetMe обрабатывает GET /auth/me
func (h *Handler) GetMe(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не аутентифицирован"})
		return
	}

	userIDUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "неверный ID пользователя"})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "пользователь не найден"})
		return
	}
	c.JSON(http.StatusOK, user)
}
