package picker

import (
	"Laman/internal/events"
	"Laman/internal/middleware"
	"Laman/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// formatRubles форматирует сумму как целое число с символом рубля, например "1 500₽".
func formatRubles(amount float64) string {
	return fmt.Sprintf("%.0f₽", amount)
}

type Handler struct {
	service     PickerService
	authService AuthService
	logger      *zap.Logger
	hub         *events.Hub
}

// RegisterRoutes регистрирует маршруты заказов.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	pikers := router.Group("/picker")
	auth := middleware.AuthMiddleware(h.authService)
	pickerOnly := middleware.RoleRequired(models.UserRolePicker)
	{
		pikers.POST("/auth/login", h.Login)
		pikers.GET("/orders/:id", auth, pickerOnly, h.GetOrder)
		pikers.GET("", auth, pickerOnly, h.GetOrders)
		pikers.GET("/events", auth, pickerOnly, h.Events)
		pikers.PUT("/orders/:id/status", auth, pickerOnly, h.UpdateStatus)
		pikers.POST("/orders/:id/items", auth, pickerOnly, h.AddItem)
		pikers.DELETE("/orders/:id/items/:itemId", auth, pickerOnly, h.RemoveItem)
	}
}

// AuthService определяет интерфейс, необходимый из модуля auth.
type AuthService interface {
	ValidateToken(ctx context.Context, token string) (uuid.UUID, string, error)
}

type PickerService interface {
	Login(ctx context.Context, login LoginRequest) (LoginResponse, error)
	GetOrder(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID) (*PickerOrderResponse, error)
	GetOrdersByUserID(ctx context.Context, storeID uuid.UUID) ([]models.Order, error)
	UpdateStatus(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID, newStatus models.OrderStatus) error
	GetStoreIDByUserID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error)
	AddItem(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID, req AddItemRequest) (*PickerOrderItem, error)
	RemoveItem(ctx context.Context, orderID uuid.UUID, itemID uuid.UUID, pickerID uuid.UUID) error
}

// orderUpdatedEvent — структура SSE-уведомления об изменении заказа.
// Используется вместо fmt.Sprintf чтобы гарантировать валидный JSON
// даже если поля содержат кавычки, обратные слеши и другие спецсимволы.
type orderUpdatedEvent struct {
	Type       string  `json:"type"`
	OrderID    string  `json:"order_id"`
	Message    string  `json:"message"`
	FinalTotal float64 `json:"final_total"`
}

// notifyOrderUpdated отправляет SSE-уведомление клиенту об изменении заказа.
// Возвращает пустую строку и не паникует при ошибке сериализации.
func notifyOrderUpdated(hub *events.Hub, userID uuid.UUID, orderID uuid.UUID, message string, finalTotal float64) {
	event := orderUpdatedEvent{
		Type:       "order_updated",
		OrderID:    orderID.String(),
		Message:    message,
		FinalTotal: finalTotal,
	}
	data, err := json.Marshal(event)
	if err != nil {
		// json.Marshal на структуре без интерфейсных полей не может вернуть ошибку,
		// но обрабатываем на случай будущих изменений структуры.
		return
	}
	hub.Notify(userID, string(data))
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

	userIDRaw, _ := c.Get("user_id")
	pickerID, _ := userIDRaw.(uuid.UUID)

	order, err := h.service.GetOrder(c.Request.Context(), id, pickerID)
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

	pickerIDRaw, _ := c.Get("user_id")
	pickerID, _ := pickerIDRaw.(uuid.UUID)

	var req AddItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.service.AddItem(c.Request.Context(), orderID, pickerID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	order, err := h.service.GetOrder(c.Request.Context(), orderID, pickerID)
	if err == nil && order.UserID != nil {
		msg := "Сборщик добавил товар «" + req.ProductName + "». Новая сумма: " + formatRubles(order.FinalTotal)
		notifyOrderUpdated(h.hub, *order.UserID, orderID, msg, order.FinalTotal)
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

	pickerIDForRemove, _ := c.Get("user_id")
	pickerIDUUID, _ := pickerIDForRemove.(uuid.UUID)

	if err := h.service.RemoveItem(c.Request.Context(), orderID, itemID, pickerIDUUID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	order, err := h.service.GetOrder(c.Request.Context(), orderID, pickerIDUUID)
	if err == nil && order.UserID != nil {
		msg := "Сборщик изменил состав заказа. Новая сумма: " + formatRubles(order.FinalTotal)
		notifyOrderUpdated(h.hub, *order.UserID, orderID, msg, order.FinalTotal)
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
