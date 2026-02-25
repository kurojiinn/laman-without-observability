package courier

import (
	"Laman/internal/middleware"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	courierService *Service
	authService    AuthService
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(token string) (uuid.UUID, error)
}

// NewHandler создает новый обработчик заказов.
func NewHandler(courierService *Service, authService AuthService) *Handler {
	return &Handler{
		courierService: courierService,
		authService:    authService,
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	couriers := router.Group("/courier")
	{
		couriers.POST("/location", middleware.AuthMiddleware(h.authService), h.UpdateLocation)
	}
}

func (h *Handler) UpdateLocation(c *gin.Context) {
	var req UpdateCourierLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не аутентифицирован"})
		return
	}

	userIDUUID, ok := userID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "неверный ID курьера"})
		return
	}

	err := h.courierService.UpdateLocation(c.Request.Context(), userIDUUID, req.Lat, req.Lng)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "местоположение обновлено"})
}
