package orders

import (
	"net/http"
	"Laman/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler обрабатывает HTTP запросы для заказов.
type Handler struct {
	orderService *OrderService
	authService  AuthService
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(token string) (uuid.UUID, error)
}

// NewHandler создает новый обработчик заказов.
func NewHandler(orderService *OrderService, authService AuthService) *Handler {
	return &Handler{
		orderService: orderService,
		authService:  authService,
	}
}

// RegisterRoutes регистрирует маршруты заказов.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	orders := router.Group("/orders")
	{
		orders.POST("", h.CreateOrder)
		orders.GET("/:id", h.GetOrder)
		orders.GET("", middleware.AuthMiddleware(h.authService), h.GetUserOrders)
		orders.PUT("/:id/status", h.UpdateOrderStatus)
	}
}

// CreateOrder обрабатывает POST /orders
func (h *Handler) CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Если пользователь аутентифицирован, устанавливаем user_id
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			userID, err := h.authService.ValidateToken(authHeader[7:])
			if err == nil {
				req.UserID = &userID
			}
		}
	}

	order, err := h.orderService.CreateOrder(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

// GetOrder обрабатывает GET /orders/:id
func (h *Handler) GetOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	order, err := h.orderService.GetOrder(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

// GetUserOrders обрабатывает GET /orders
func (h *Handler) GetUserOrders(c *gin.Context) {
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

	orders, err := h.orderService.GetUserOrders(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// UpdateOrderStatus обрабатывает PUT /orders/:id/status
func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.orderService.UpdateOrderStatus(c.Request.Context(), id, req.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "статус заказа обновлен"})
}
