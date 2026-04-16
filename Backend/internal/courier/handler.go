package courier

import (
	"Laman/internal/middleware"
	"Laman/internal/models"
	"Laman/internal/observability"
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Handler struct {
	courierService *Service
	authService    AuthService
	logger         *zap.Logger
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (uuid.UUID, string, error)
}

// NewHandler создает новый обработчик заказов.
func NewHandler(courierService *Service, authService AuthService, logger *zap.Logger) *Handler {
	return &Handler{
		courierService: courierService,
		authService:    authService,
		logger:         logger,
	}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	couriers := router.Group("/courier")
	auth := middleware.AuthMiddleware(h.authService)
	courierOnly := middleware.RoleRequired(models.UserRoleCourier)
	{
		couriers.POST("/location", auth, courierOnly, h.UpdateLocation)
		couriers.GET("/location/:courierId", auth, courierOnly, h.GetCourierLocation)
		couriers.POST("/shift/start", auth, courierOnly, h.StartShift)
		couriers.POST("/shift/end", auth, courierOnly, h.EndShift)
	}
}

func (h *Handler) UpdateLocation(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "courier.update_location")
	defer span.End()

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

	err := h.courierService.UpdateLocation(ctx, userIDUUID, req.Lat, req.Lng)
	if err != nil {
		courierLocationErrorsTotal.WithLabelValues("update_failed").Inc()
		h.logger.Error("ошибка не удалось обновить данные в кеше", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courierLocationUpdatesTotal.WithLabelValues(userIDUUID.String()).Inc()
	h.logger.Info("Успешно обновлено местоположение", zap.String("courier_id", userIDUUID.String()), zap.Float64("Lat", req.Lat), zap.Float64("Lng", req.Lng))
	c.JSON(http.StatusOK, gin.H{"message": "местоположение обновлено"})
}

func (h *Handler) GetCourierLocation(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "courier.get_location")
	defer span.End()
	courierID, err := uuid.Parse(c.Param("courierId"))
	if err != nil {
		courierLocationErrorsTotal.WithLabelValues("get_failed").Inc()
		h.logger.Error("ошибка не удалось найти данные", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID курьера"})
		return
	}

	location, err := h.courierService.GetLocation(ctx, courierID)
	if err != nil {
		courierLocationErrorsTotal.WithLabelValues("get_failed").Inc()
		h.logger.Error("ошибка не удалось получить данные из кеше", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "ошибка при получении локации курьера"})
		return
	}

	if location == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найден"})
		return
	}
	h.logger.Info("Успешно получен курьер", zap.String("courier_id", courierID.String()))
	c.JSON(http.StatusOK, location)
}
func (h *Handler) StartShift(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "courier.start_shift")
	defer span.End()

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

	err := h.courierService.StartShift(ctx, userIDUUID, req.Lat, req.Lng)
	if err != nil {
		h.logger.Error("не удалось начать смену", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "ошибка локации курьера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "смена начата"})
}

func (h *Handler) EndShift(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "courier.end_shift")
	defer span.End()

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
	err := h.courierService.EndShift(ctx, userIDUUID)
	if err != nil {
		h.logger.Error("не удалось удалить смену", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "ошибка локации курьера"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "смена завершена"})
}
