package picker

import (
	"Laman/internal/events"
	"Laman/internal/middleware"
	"Laman/internal/models"
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type Handler struct {
	service     PickerService
	authService AuthService
	logger      *zap.Logger
	hub         *events.Hub
}

// RegisterRoutes регистрирует маршруты заказов.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	pikers := router.Group("/picker")
	{
		pikers.POST("/auth/login", h.Login)
		pikers.GET("/orders/:id", middleware.AuthMiddleware(h.authService), h.GetOrder)
		pikers.GET("", middleware.AuthMiddleware(h.authService), h.GetOrders)
		pikers.GET("/events", middleware.AuthMiddleware(h.authService), h.Events)
		pikers.PUT("/orders/:id/status", middleware.AuthMiddleware(h.authService), h.UpdateStatus)
		pikers.POST("/orders/:id/items", middleware.AuthMiddleware(h.authService), h.AddItem)
		pikers.DELETE("/orders/:id/items/:itemId", middleware.AuthMiddleware(h.authService), h.RemoveItem)
	}
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(token string) (uuid.UUID, error)
}

type PickerService interface {
	Login(ctx context.Context, login LoginRequest) (LoginResponse, error)
	GetOrder(ctx context.Context, orderID uuid.UUID) (*PickerOrderResponse, error)
	GetOrdersByUserID(ctx context.Context, storeID uuid.UUID) ([]models.Order, error)
	UpdateStatus(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID, newStatus models.OrderStatus) error
	GetStoreIDByUserID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error)
	AddItem(ctx context.Context, orderID uuid.UUID, req AddItemRequest) (*PickerOrderItem, error)
	RemoveItem(ctx context.Context, orderID uuid.UUID, itemID uuid.UUID) error
}

func NewHandler(service PickerService, logger *zap.Logger, authService AuthService, hub *events.Hub) *Handler {
	return &Handler{
		service:     service,
		logger:      logger,
		authService: authService,
		hub:         hub,
	}
}

func (h *Handler) Login(c *gin.Context) {
	var login LoginRequest

	if err := c.ShouldBindJSON(&login); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	response, err := h.service.Login(c.Request.Context(), login)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "не правильный телефон или пароль"})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	order, err := h.service.GetOrder(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

func (h *Handler) GetOrders(c *gin.Context) {
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

	orders, err := h.service.GetOrdersByUserID(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	userIDRaw, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не аутентифицирован"})
		return
	}
	userID, ok := userIDRaw.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "неверный ID пользователя"})
		return
	}

	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateStatus(c.Request.Context(), id, userID, models.OrderStatus(req.Status)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "статус заказа обновлен"})
}

func (h *Handler) AddItem(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	var req AddItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.AddItem(c.Request.Context(), orderID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Уведомляем клиента через SSE
	order, err := h.service.GetOrder(c.Request.Context(), orderID)
	if err == nil && order.UserID != nil {
		msg := fmt.Sprintf(`{"type":"order_updated","order_id":"%s","message":"Сборщик добавил товар «%s». Новая сумма: %.0f₽","final_total":%.2f}`,
			orderID, req.ProductName, order.FinalTotal, order.FinalTotal)
		h.hub.Notify(*order.UserID, msg)
	}

	c.JSON(http.StatusCreated, item)
}

func (h *Handler) RemoveItem(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID заказа"})
		return
	}

	itemID, err := uuid.Parse(c.Param("itemId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID товара"})
		return
	}

	if err := h.service.RemoveItem(c.Request.Context(), orderID, itemID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Уведомляем клиента через SSE
	order, err := h.service.GetOrder(c.Request.Context(), orderID)
	if err == nil && order.UserID != nil {
		msg := fmt.Sprintf(`{"type":"order_updated","order_id":"%s","message":"Сборщик изменил состав заказа. Новая сумма: %.0f₽","final_total":%.2f}`,
			orderID, order.FinalTotal, order.FinalTotal)
		h.hub.Notify(*order.UserID, msg)
	}

	c.JSON(http.StatusOK, gin.H{"message": "товар удалён"})
}

func (h *Handler) Events(c *gin.Context) {
	userUUID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "пользователь не аутентифицирован"})
		return
	}

	userID := userUUID.(uuid.UUID)

	storeID, err := h.service.GetStoreIDByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	ch := h.hub.Subscribe(storeID)
	defer h.hub.Unsubscribe(storeID)

	for {
		select {
		case message, ok := <-ch:
			if !ok {
				return
			}
			c.SSEvent("message", message)
			c.Writer.Flush()
		case <-c.Request.Context().Done():
			return
		}
	}
}
