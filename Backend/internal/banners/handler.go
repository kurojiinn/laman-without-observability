package banners

import (
	"net/http"

	"Laman/internal/models"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	service *Service
	logger  *zap.Logger
}

func NewHandler(service *Service, logger *zap.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/banners", h.GetActiveBanners)
}

func (h *Handler) GetActiveBanners(c *gin.Context) {
	bannerList, err := h.service.GetActive(c.Request.Context())
	if err != nil {
		h.logger.Error("GetActiveBanners", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось получить баннеры"})
		return
	}
	if bannerList == nil {
		bannerList = []models.Banner{}
	}
	c.JSON(http.StatusOK, bannerList)
}
