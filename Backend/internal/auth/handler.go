package auth

import (
	"Laman/internal/middleware"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler обрабатывает HTTP запросы для аутентификации.
type Handler struct {
	authService *AuthService
}

// NewHandler создает новый обработчик аутентификации.
func NewHandler(authService *AuthService) *Handler {
	return &Handler{
		authService: authService,
	}
}

// RegisterRoutes регистрирует маршруты аутентификации.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	auth := router.Group("/auth")
	{
		auth.POST("/send-code", h.SendCode)
		auth.POST("/verify-code", h.VerifyCode)
		auth.GET("/me", middleware.AuthMiddleware(h.authService), h.GetMe)
	}
}

// SendCode обрабатывает POST /auth/send-code
func (h *Handler) SendCode(c *gin.Context) {
	var req SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.authService.SendCode(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "код верификации отправлен"})
}

// VerifyCode обрабатывает POST /auth/verify-code
func (h *Handler) VerifyCode(c *gin.Context) {
	var req VerifyCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.authService.VerifyCode(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
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

	c.JSON(http.StatusOK, gin.H{"user_id": userIDUUID})
}
