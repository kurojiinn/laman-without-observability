package options

import (
	"context"
	"net/http"
	"strings"

	"Laman/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler инкапсулирует admin-эндпоинты для управления опциями товара.
// Регистрируется на admin-router (защищён BasicAuth).
type Handler struct {
	service Service
}

// Service — поведенческий контракт над репозиторием.
type Service interface {
	GetGroupsByProduct(ctx context.Context, productID uuid.UUID) ([]models.ProductOptionGroup, error)
	CreateGroup(ctx context.Context, productID uuid.UUID, name, kind string, isRequired bool, position int) (*models.ProductOptionGroup, error)
	UpdateGroup(ctx context.Context, id uuid.UUID, name, kind string, isRequired bool, position int) error
	DeleteGroup(ctx context.Context, id uuid.UUID) error
	CreateValue(ctx context.Context, groupID uuid.UUID, name string, priceDelta *float64, isDefault bool, position int) (*models.ProductOptionValue, error)
	UpdateValue(ctx context.Context, id uuid.UUID, name string, priceDelta *float64, isDefault bool, position int) error
	DeleteValue(ctx context.Context, id uuid.UUID) error
}

// NewHandler — конструктор.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes цепляет admin-роуты на /admin/...
func (h *Handler) RegisterRoutes(admin *gin.RouterGroup) {
	admin.GET("/products/:id/option-groups", h.ListGroups)
	admin.POST("/products/:id/option-groups", h.CreateGroup)
	admin.PATCH("/option-groups/:groupId", h.UpdateGroup)
	admin.DELETE("/option-groups/:groupId", h.DeleteGroup)
	admin.POST("/option-groups/:groupId/values", h.CreateValue)
	admin.PATCH("/option-values/:valueId", h.UpdateValue)
	admin.DELETE("/option-values/:valueId", h.DeleteValue)
}

func badRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"error": msg})
}

func serverError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

// ListGroups возвращает группы опций товара с их значениями.
func (h *Handler) ListGroups(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "неверный ID товара")
		return
	}
	groups, err := h.service.GetGroupsByProduct(c.Request.Context(), productID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, groups)
}

type createGroupReq struct {
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	IsRequired *bool  `json:"is_required"`
	Position   int    `json:"position"`
}

// CreateGroup добавляет группу опций к товару.
func (h *Handler) CreateGroup(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		badRequest(c, "неверный ID товара")
		return
	}
	var req createGroupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		badRequest(c, "название группы обязательно")
		return
	}
	required := true
	if req.IsRequired != nil {
		required = *req.IsRequired
	}
	g, err := h.service.CreateGroup(c.Request.Context(), productID, req.Name, req.Kind, required, req.Position)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, g)
}

type updateGroupReq struct {
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	IsRequired bool   `json:"is_required"`
	Position   int    `json:"position"`
}

func (h *Handler) UpdateGroup(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("groupId"))
	if err != nil {
		badRequest(c, "неверный ID группы")
		return
	}
	var req updateGroupReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateGroup(c.Request.Context(), groupID, req.Name, req.Kind, req.IsRequired, req.Position); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) DeleteGroup(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("groupId"))
	if err != nil {
		badRequest(c, "неверный ID группы")
		return
	}
	if err := h.service.DeleteGroup(c.Request.Context(), groupID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

type createValueReq struct {
	Name       string   `json:"name"`
	PriceDelta *float64 `json:"price_delta"`
	IsDefault  bool     `json:"is_default"`
	Position   int      `json:"position"`
}

func (h *Handler) CreateValue(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("groupId"))
	if err != nil {
		badRequest(c, "неверный ID группы")
		return
	}
	var req createValueReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		badRequest(c, "название обязательно")
		return
	}
	v, err := h.service.CreateValue(c.Request.Context(), groupID, req.Name, req.PriceDelta, req.IsDefault, req.Position)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, v)
}

type updateValueReq struct {
	Name       string   `json:"name"`
	PriceDelta *float64 `json:"price_delta"`
	IsDefault  bool     `json:"is_default"`
	Position   int      `json:"position"`
}

func (h *Handler) UpdateValue(c *gin.Context) {
	valueID, err := uuid.Parse(c.Param("valueId"))
	if err != nil {
		badRequest(c, "неверный ID значения")
		return
	}
	var req updateValueReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, err.Error())
		return
	}
	if err := h.service.UpdateValue(c.Request.Context(), valueID, req.Name, req.PriceDelta, req.IsDefault, req.Position); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) DeleteValue(c *gin.Context) {
	valueID, err := uuid.Parse(c.Param("valueId"))
	if err != nil {
		badRequest(c, "неверный ID значения")
		return
	}
	if err := h.service.DeleteValue(c.Request.Context(), valueID); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
