package users

import (
	"net/http"
	"Laman/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler обрабатывает HTTP запросы для пользователей.
type Handler struct {
	userService *UserService
	authService AuthService
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(token string) (uuid.UUID, error)
}

// NewHandler создает новый обработчик пользователей.
func NewHandler(userService *UserService, authService AuthService) *Handler {
	return &Handler{
		userService: userService,
		authService: authService,
	}
}

// RegisterRoutes регистрирует маршруты пользователей.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	users := router.Group("/users")
	users.Use(middleware.AuthMiddleware(h.authService))
	{
		users.GET("/me", h.GetMe)
		users.GET("/profile", h.GetProfile)
		users.PUT("/profile", h.UpdateProfile)
	}
}

// GetMe обрабатывает GET /users/me
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

	user, err := h.userService.GetUser(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetProfile обрабатывает GET /users/profile
func (h *Handler) GetProfile(c *gin.Context) {
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

	profile, err := h.userService.GetProfile(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateProfile обрабатывает PUT /users/profile
func (h *Handler) UpdateProfile(c *gin.Context) {
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

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile, err := h.userService.UpdateProfile(c.Request.Context(), userIDUUID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}
