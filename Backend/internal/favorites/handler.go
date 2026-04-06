package favorites

import (
	"net/http"

	"Laman/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AuthService — минимальный интерфейс для валидации токена.
type AuthService interface {
	ValidateToken(token string) (uuid.UUID, error)
}

// Handler обрабатывает HTTP-запросы для избранного.
type Handler struct {
	service     *Service
	authService AuthService
	logger      *zap.Logger
}

// NewHandler создаёт новый Handler.
func NewHandler(service *Service, authService AuthService, logger *zap.Logger) *Handler {
	return &Handler{
		service:     service,
		authService: authService,
		logger:      logger,
	}
}

// RegisterRoutes регистрирует маршруты. Все — только для авторизованных.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	fav := router.Group("/favorites")
	fav.Use(middleware.AuthMiddleware(h.authService))
	{
		fav.GET("", h.GetFavorites)
		fav.POST("", h.AddFavorite)
		fav.DELETE("/:product_id", h.RemoveFavorite)
	}
}

// GetFavorites — GET /api/v1/favorites
func (h *Handler) GetFavorites(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	products, err := h.service.GetByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, products)
}

type addFavoriteRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
}

// AddFavorite — POST /api/v1/favorites
func (h *Handler) AddFavorite(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req addFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.Add(c.Request.Context(), userID, req.ProductID); err != nil {
		h.logger.Error("Ошибка добавления в избранное", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// RemoveFavorite — DELETE /api/v1/favorites/:product_id
func (h *Handler) RemoveFavorite(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	productID, err := uuid.Parse(c.Param("product_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный id товара"})
		return
	}

	if err := h.service.Remove(c.Request.Context(), userID, productID); err != nil {
		h.logger.Error("Ошибка удаления из избранного", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
