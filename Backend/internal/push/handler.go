package push

import (
	"fmt"
	"net/http"

	"Laman/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	svc         *Service
	authService middleware.TokenValidator
}

func NewHandler(svc *Service, authService middleware.TokenValidator) *Handler {
	return &Handler{svc: svc, authService: authService}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	push := router.Group("/push")
	push.GET("/vapid-key", h.GetVAPIDKey)

	auth := push.Group("")
	auth.Use(middleware.AuthMiddleware(h.authService))
	auth.POST("/subscribe", h.Subscribe)
	auth.POST("/unsubscribe", h.Unsubscribe)
}

type subscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	P256dh   string `json:"p256dh"   binding:"required"`
	Auth     string `json:"auth"     binding:"required"`
}

func (h *Handler) Subscribe(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "не авторизован"})
		return
	}

	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректные данные"})
		return
	}

	uid, err := uuid.Parse(fmt.Sprintf("%v", userID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный user id"})
		return
	}

	if err := h.svc.Subscribe(c.Request.Context(), uid, Subscription(req)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось сохранить подписку"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) Unsubscribe(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "не авторизован"})
		return
	}

	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "некорректные данные"})
		return
	}

	uid, _ := uuid.Parse(fmt.Sprintf("%v", userID))
	_ = h.svc.Unsubscribe(c.Request.Context(), uid, req.Endpoint)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) GetVAPIDKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"public_key": h.svc.VAPIDPublicKey()})
}
