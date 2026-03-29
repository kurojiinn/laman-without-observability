package catalog

import (
	"net/http"
	"time"

	"Laman/internal/models"
	"Laman/internal/observability"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Handler обрабатывает HTTP запросы для каталога.
type Handler struct {
	catalogService *CatalogService
	logger         *zap.Logger
}

// NewHandler создает новый обработчик каталога.
func NewHandler(catalogService *CatalogService, logger *zap.Logger) *Handler {
	return &Handler{
		catalogService: catalogService,
		logger:         logger,
	}
}

// RegisterRoutes регистрирует маршруты каталога.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup) {
	catalog := router.Group("/catalog")
	{
		catalog.GET("/categories", h.GetCategories)
		catalog.GET("/subcategories", h.GetSubcategories)
		catalog.GET("/products", h.GetProducts)
		catalog.GET("/products/:id", h.GetProduct)
	}

	stores := router.Group("/stores")
	{
		stores.GET("", h.GetStores)
		stores.GET("/:id", h.GetStore)
		stores.GET("/:id/subcategories", h.GetStoreSubcategories)
		stores.GET("/:id/products", h.GetStoreProducts)
	}
}

// GetCategories обрабатывает GET /catalog/categories
func (h *Handler) GetCategories(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_categories")
	defer span.End()

	start := time.Now()
	categories, err := h.catalogService.GetCategories(ctx)
	if err != nil {
		h.logger.Error("Не удалось получить категории", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Категории отданы", zap.Int("count", len(categories)), zap.Duration("duration", time.Since(start)))
	c.JSON(http.StatusOK, categories)
}

// GetProducts обрабатывает GET /catalog/products
func (h *Handler) GetProducts(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_products")
	defer span.End()

	start := time.Now()
	var categoryID *uuid.UUID
	if catIDStr := c.Query("category_id"); catIDStr != "" {
		if catID, err := uuid.Parse(catIDStr); err == nil {
			categoryID = &catID
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный category_id"})
			return
		}
	}

	var subcategoryID *uuid.UUID
	if subIDStr := c.Query("subcategory_id"); subIDStr != "" {
		if subID, err := uuid.Parse(subIDStr); err == nil {
			subcategoryID = &subID
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный subcategory_id"})
			return
		}
	}

	var search *string
	if searchStr := c.Query("search"); searchStr != "" {
		search = &searchStr
	}

	availableOnly := c.Query("available_only") == "true"

	products, err := h.catalogService.GetProductsWithFilters(ctx, categoryID, subcategoryID, search, availableOnly)
	if err != nil {
		h.logger.Error("Не удалось получить товары", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Товары отданы",
		zap.Int("count", len(products)),
		zap.Bool("available_only", availableOnly),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, products)
}

// GetSubcategories обрабатывает GET /catalog/subcategories
func (h *Handler) GetSubcategories(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_subcategories")
	defer span.End()

	start := time.Now()
	catIDStr := c.Query("category_id")
	if catIDStr == "" {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	categoryID, err := uuid.Parse(catIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID категории"})
		return
	}

	subcategories, err := h.catalogService.GetSubcategories(ctx, categoryID)
	if err != nil {
		h.logger.Error("Не удалось получить подкатегории",
			zap.String("category_id", categoryID.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Подкатегории отданы",
		zap.String("category_id", categoryID.String()),
		zap.Int("count", len(subcategories)),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, subcategories)
}

// GetProduct обрабатывает GET /catalog/products/:id
func (h *Handler) GetProduct(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_product")
	defer span.End()

	start := time.Now()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID товара"})
		return
	}

	product, err := h.catalogService.GetProduct(ctx, id)
	if err != nil {
		h.logger.Warn("Товар не найден",
			zap.String("product_id", id.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Товар отдан",
		zap.String("product_id", id.String()),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, product)
}

// GetStores обрабатывает GET /stores
func (h *Handler) GetStores(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_stores")
	defer span.End()

	start := time.Now()
	var categoryType *models.StoreCategoryType
	if typeStr := c.Query("category_type"); typeStr != "" {
		ct := models.StoreCategoryType(typeStr)
		categoryType = &ct
	}

	var search *string
	if searchStr := c.Query("search"); searchStr != "" {
		search = &searchStr
	}

	stores, err := h.catalogService.GetStores(ctx, categoryType, search)
	if err != nil {
		h.logger.Error("Не удалось получить магазины", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Магазины отданы", zap.Int("count", len(stores)), zap.Duration("duration", time.Since(start)))
	c.JSON(http.StatusOK, stores)
}

// GetStore обрабатывает GET /stores/:id
func (h *Handler) GetStore(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_store")
	defer span.End()

	start := time.Now()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	store, err := h.catalogService.GetStore(ctx, id)
	if err != nil {
		h.logger.Warn("Магазин не найден",
			zap.String("store_id", id.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Магазин отдан", zap.String("store_id", id.String()), zap.Duration("duration", time.Since(start)))
	c.JSON(http.StatusOK, store)
}

// GetStoreSubcategories обрабатывает GET /stores/:id/subcategories
func (h *Handler) GetStoreSubcategories(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_store_subcategories")
	defer span.End()

	start := time.Now()
	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	subcategories, err := h.catalogService.GetStoreSubcategories(ctx, storeID)
	if err != nil {
		h.logger.Error("Не удалось получить подкатегории магазина",
			zap.String("store_id", storeID.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Подкатегории магазина отданы",
		zap.String("store_id", storeID.String()),
		zap.Int("count", len(subcategories)),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, subcategories)
}

// GetStoreProducts обрабатывает GET /stores/:id/products
func (h *Handler) GetStoreProducts(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_store_products")
	defer span.End()

	start := time.Now()
	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	var subcategoryID *uuid.UUID
	if subIDStr := c.Query("subcategory_id"); subIDStr != "" {
		if subID, err := uuid.Parse(subIDStr); err == nil {
			subcategoryID = &subID
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный subcategory_id"})
			return
		}
	}

	var search *string
	if searchStr := c.Query("search"); searchStr != "" {
		search = &searchStr
	}

	availableOnly := c.Query("available_only") == "true"

	products, err := h.catalogService.GetStoreProducts(ctx, storeID, subcategoryID, search, availableOnly)
	if err != nil {
		h.logger.Error("Не удалось получить товары магазина",
			zap.String("store_id", storeID.String()),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Товары магазина отданы",
		zap.String("store_id", storeID.String()),
		zap.Int("count", len(products)),
		zap.Bool("available_only", availableOnly),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, products)
}
