package orders

import (
	"Laman/internal/events"
	"Laman/internal/middleware"
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler обрабатывает HTTP запросы для заказов.
type Handler struct {
	orderService *OrderService
	authService  AuthService
	hub          *events.Hub
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (uuid.UUID, string, error)
}

// NewHandler создает новый обработчик заказов.
func NewHandler(orderService *OrderService, authService AuthService, hub *events.Hub) *Handler {
	return &Handler{
		orderService: orderService,
		authService:  authService,
		hub:          hub,
	}
}

// RegisterRoutes регистрирует маршруты заказов.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	orders := router.Group("/orders")
	auth := middleware.AuthMiddleware(h.authService)
	sseAuth := middleware.SSEAuthMiddleware(h.authService)
	{
		orders.POST("", auth, h.CreateOrder)
		orders.GET("/:id", auth, h.GetOrder)
		orders.GET("", auth, h.GetUserOrders)
		orders.POST("/:id/cancel", auth, h.CancelOrder)
		orders.GET("/events", sseAuth, h.Events)
	}
}

// CreateOrder обрабатывает POST /orders
func (h *Handler) CreateOrder(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDUUID := userID.(uuid.UUID)

	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.UserID = userIDUUID

	order, err := h.orderService.CreateOrder(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

// GetOrder обрабатывает GET /orders/:id
func (h *Handler) GetOrder(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDUUID := userID.(uuid.UUID)

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

	if order.UserID == nil || *order.UserID != userIDUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "доступ запрещён"})
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

// Events обрабатывает GET /orders/events — SSE поток уведомлений для клиента.
func (h *Handler) Events(c *gin.Context) {
	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не аутентифицирован"})
		return
	}
	userID := userIDRaw.(uuid.UUID)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	ch := h.hub.Subscribe(userID, userID)
	defer h.hub.Unsubscribe(userID, userID)

	for {
		select {
		case message, ok := <-ch:
			if !ok {
				return
			}
			c.SSEvent("order_updated", message)
			c.Writer.Flush()
		case <-c.Request.Context().Done():
			return
		}
	}
}

// CancelOrder обрабатывает POST /orders/:id/cancel — отмена заказа клиентом.
func (h *Handler) CancelOrder(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDUUID := userID.(uuid.UUID)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	if err := h.orderService.CancelOrderByUser(c.Request.Context(), id, userIDUUID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "заказ отменён"})
}

