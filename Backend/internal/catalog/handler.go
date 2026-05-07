package catalog

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"Laman/internal/models"
	"Laman/internal/observability"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// TokenValidator абстрагирует валидацию JWT (избегаем import cycle).
type TokenValidator interface {
	ValidateToken(ctx context.Context, tokenString string) (uuid.UUID, string, error)
}

// Handler обрабатывает HTTP запросы для каталога.
type Handler struct {
	catalogService *CatalogService
	authService    TokenValidator
	logger         *zap.Logger
	uploadsBaseURL string
}

// NewHandler создает новый обработчик каталога.
func NewHandler(catalogService *CatalogService, logger *zap.Logger) *Handler {
	return &Handler{
		catalogService: catalogService,
		logger:         logger,
	}
}

// WithUploadsBaseURL задаёт базовый URL для загрузок.
func (h *Handler) WithUploadsBaseURL(url string) *Handler {
	h.uploadsBaseURL = strings.TrimRight(url, "/")
	return h
}

// WithAuth добавляет TokenValidator для защищённых эндпоинтов отзывов.
func (h *Handler) WithAuth(auth TokenValidator) *Handler {
	h.authService = auth
	return h
}

// RegisterAdminRoutes регистрирует защищённые маршруты каталога для ADMIN (JWT + AdminRole).
func (h *Handler) RegisterAdminRoutes(router *gin.RouterGroup, authMW gin.HandlerFunc, adminMW gin.HandlerFunc) {
	products := router.Group("/catalog/products", authMW, adminMW)
	{
		products.PATCH("/:id", h.AdminUpdateProduct)
	}
	stores := router.Group("/stores", authMW, adminMW)
	{
		stores.PATCH("/:id", h.AdminUpdateStore)
	}
	recipes := router.Group("/catalog/recipes", authMW, adminMW)
	{
		recipes.POST("", h.AdminCreateRecipe)
		recipes.PATCH("/:id", h.AdminUpdateRecipe)
		recipes.DELETE("/:id", h.AdminDeleteRecipe)
		recipes.POST("/:id/products", h.AdminAddRecipeProduct)
		recipes.DELETE("/:id/products/:product_id", h.AdminRemoveRecipeProduct)
	}
	scenarios := router.Group("/catalog/scenarios", authMW, adminMW)
	{
		scenarios.GET("/all", h.AdminGetScenarios)
		scenarios.POST("", h.AdminCreateScenario)
		scenarios.PATCH("/:id", h.AdminUpdateScenario)
		scenarios.DELETE("/:id", h.AdminDeleteScenario)
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
		catalog.GET("/featured", h.GetFeatured)
		catalog.GET("/recipes", h.GetRecipes)
		catalog.GET("/recipes/:id", h.GetRecipe)
		catalog.GET("/scenarios", h.GetScenarios)
		catalog.GET("/store-category-meta", h.GetStoreCategoryMeta)
	}

	stores := router.Group("/stores")
	{
		stores.GET("", h.GetStores)
		stores.GET("/:id", h.GetStore)
		stores.GET("/:id/subcategories", h.GetStoreSubcategories)
		stores.GET("/:id/products", h.GetStoreProducts)
		stores.GET("/:id/reviews", h.GetStoreReviews)
		stores.GET("/:id/can-review", h.CanReview)
		stores.POST("/:id/reviews", h.CreateReview)
		stores.DELETE("/:id/reviews/:review_id", h.DeleteOwnReview)
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

	// Пагинация: ?limit=20&offset=0. Если не задано — limit=20 по умолчанию.
	page := parsePage(c)
	products, total, err := h.catalogService.GetProductsWithFilters(ctx, categoryID, subcategoryID, search, availableOnly, &page)
	if err != nil {
		h.logger.Error("Не удалось получить товары", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Товары отданы",
		zap.Int("count", len(products)),
		zap.Int("total", total),
		zap.Bool("available_only", availableOnly),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, models.NewPaginatedResponse(products, total, page))
}

// parsePage читает limit/offset из query string с дефолтами.
func parsePage(c *gin.Context) models.Page {
	limit, _ := strconv.Atoi(c.Query("limit"))
	offset, _ := strconv.Atoi(c.Query("offset"))
	return models.NormalizePage(limit, offset)
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
	page := parsePage(c)
	sort := c.Query("sort")

	products, total, err := h.catalogService.GetStoreProducts(ctx, storeID, subcategoryID, search, availableOnly, sort, &page)
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
		zap.Int("total", total),
		zap.Bool("available_only", availableOnly),
		zap.Duration("duration", time.Since(start)),
	)
	c.JSON(http.StatusOK, models.NewPaginatedResponse(products, total, page))
}

// GetStoreReviews обрабатывает GET /stores/:id/reviews
func (h *Handler) GetStoreReviews(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.get_store_reviews")
	defer span.End()

	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	reviews, err := h.catalogService.GetReviews(ctx, storeID)
	if err != nil {
		h.logger.Error("Не удалось получить отзывы", zap.String("store_id", storeID.String()), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, reviews)
}

// CanReview обрабатывает GET /stores/:id/can-review
// Требует авторизации; возвращает { "can_review": bool }
func (h *Handler) CanReview(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.can_review")
	defer span.End()

	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	userID, ok := h.extractUserID(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"can_review": false})
		return
	}

	canReview, err := h.catalogService.CanUserReview(ctx, storeID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"can_review": canReview})
}

// CreateReview обрабатывает POST /stores/:id/reviews
func (h *Handler) CreateReview(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "catalog.create_review")
	defer span.End()

	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	userID, ok := h.extractUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "требуется авторизация"})
		return
	}

	var req struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат запроса"})
		return
	}
	if req.Rating < 1 || req.Rating > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "оценка должна быть от 1 до 5"})
		return
	}
	if strings.TrimSpace(req.Comment) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "комментарий не может быть пустым"})
		return
	}

	review, err := h.catalogService.CreateReview(ctx, storeID, userID, req.Rating, strings.TrimSpace(req.Comment))
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "нет доставленного заказа") || strings.Contains(msg, "уже оставлен") {
			c.JSON(http.StatusForbidden, gin.H{"error": msg})
			return
		}
		h.logger.Error("Не удалось создать отзыв", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
		return
	}

	c.JSON(http.StatusCreated, review)
}

// AdminUpdateProduct обрабатывает PATCH /catalog/products/:id (только для ADMIN)
func (h *Handler) AdminUpdateProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID товара"})
		return
	}

	var req struct {
		Name        string   `json:"name"`
		Price       float64  `json:"price"`
		Description *string  `json:"description"`
		IsAvailable bool     `json:"is_available"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат запроса"})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "название обязательно"})
		return
	}
	if req.Price <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "цена должна быть больше 0"})
		return
	}

	product, err := h.catalogService.UpdateProduct(c.Request.Context(), id, req.Name, req.Price, req.Description, req.IsAvailable)
	if err != nil {
		h.logger.Error("Не удалось обновить товар", zap.String("product_id", id.String()), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, product)
}

// AdminUpdateStore обрабатывает PATCH /stores/:id (только для ADMIN)
func (h *Handler) AdminUpdateStore(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID магазина"})
		return
	}

	var req struct {
		Name        string  `json:"name"`
		Address     string  `json:"address"`
		Description *string `json:"description"`
		OpensAt     *string `json:"opens_at"`
		ClosesAt    *string `json:"closes_at"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат запроса"})
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "название обязательно"})
		return
	}

	store, err := h.catalogService.UpdateStore(c.Request.Context(), id, req.Name, req.Address, req.Description, req.OpensAt, req.ClosesAt)
	if err != nil {
		h.logger.Error("Не удалось обновить магазин", zap.String("store_id", id.String()), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, store)
}

// DeleteOwnReview обрабатывает DELETE /stores/:id/reviews/:review_id
// Админ удаляет любой отзыв, обычный пользователь — только свой.
func (h *Handler) DeleteOwnReview(c *gin.Context) {
	reviewID, err := uuid.Parse(c.Param("review_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID отзыва"})
		return
	}
	userID, role, ok := h.extractUserIDAndRole(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "требуется авторизация"})
		return
	}
	if role == "ADMIN" {
		if err := h.catalogService.DeleteReview(c.Request.Context(), reviewID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		if err := h.catalogService.DeleteOwnReview(c.Request.Context(), reviewID, userID); err != nil {
			if err.Error() == "отзыв не найден или не принадлежит пользователю" {
				c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AdminDeleteReview обрабатывает DELETE /stores/:id/reviews/:review_id (только для ADMIN)
func (h *Handler) AdminDeleteReview(c *gin.Context) {
	reviewID, err := uuid.Parse(c.Param("review_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID отзыва"})
		return
	}

	if err := h.catalogService.DeleteReview(c.Request.Context(), reviewID); err != nil {
		h.logger.Error("Не удалось удалить отзыв", zap.String("review_id", reviewID.String()), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// extractUserID читает JWT из заголовка Authorization и возвращает userID.
func (h *Handler) extractUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, _, ok := h.extractUserIDAndRole(c)
	return userID, ok
}

// extractUserIDAndRole читает JWT из Bearer-заголовка или httpOnly cookie и возвращает userID + роль.
func (h *Handler) extractUserIDAndRole(c *gin.Context) (uuid.UUID, string, bool) {
	if h.authService == nil {
		return uuid.Nil, "", false
	}
	var token string
	if authHeader := c.GetHeader("Authorization"); authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return uuid.Nil, "", false
		}
		token = parts[1]
	} else if cookie, err := c.Cookie("auth_token"); err == nil && cookie != "" {
		token = cookie
	} else {
		return uuid.Nil, "", false
	}
	userID, role, err := h.authService.ValidateToken(c.Request.Context(), token)
	if err != nil {
		return uuid.Nil, "", false
	}
	return userID, role, true
}

// GetFeatured возвращает товары блока витрины.
// GET /api/v1/catalog/featured?block=new_items
func (h *Handler) GetFeatured(c *gin.Context) {
	blockType := models.FeaturedBlockType(c.Query("block"))
	switch blockType {
	case models.FeaturedBlockNewItems, models.FeaturedBlockHits, models.FeaturedBlockMovieNight,
		models.FeaturedBlockQuickSnack, models.FeaturedBlockLazyCook:
		// валидный тип
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный тип блока"})
		return
	}

	products, err := h.catalogService.GetFeaturedProducts(c.Request.Context(), blockType)
	if err != nil {
		h.logger.Error("GetFeatured", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось получить товары витрины"})
		return
	}
	c.JSON(http.StatusOK, products)
}

// GetRecipes возвращает список всех рецептов.
// GET /api/v1/catalog/recipes
func (h *Handler) GetRecipes(c *gin.Context) {
	recipes, err := h.catalogService.GetRecipes(c.Request.Context())
	if err != nil {
		h.logger.Error("GetRecipes", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "не удалось получить рецепты"})
		return
	}
	c.JSON(http.StatusOK, recipes)
}

// GetRecipe возвращает рецепт с ингредиентами.
// GET /api/v1/catalog/recipes/:id
func (h *Handler) GetRecipe(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID рецепта"})
		return
	}
	recipe, err := h.catalogService.GetRecipe(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recipe)
}

// AdminCreateRecipe создаёт новый рецепт.
func (h *Handler) AdminCreateRecipe(c *gin.Context) {
	var req struct {
		StoreID     *string `json:"store_id"`
		Name        string  `json:"name"`
		Description *string `json:"description"`
		ImageURL    *string `json:"image_url"`
		Position    int     `json:"position"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат"})
		return
	}
	recipe := &models.Recipe{Name: strings.TrimSpace(req.Name), Description: req.Description, ImageURL: req.ImageURL, Position: req.Position}
	if req.StoreID != nil && *req.StoreID != "" {
		id, err := uuid.Parse(*req.StoreID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный store_id"})
			return
		}
		recipe.StoreID = &id
	}
	if err := h.catalogService.CreateRecipe(c.Request.Context(), recipe); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, recipe)
}

// AdminUpdateRecipe обновляет рецепт.
func (h *Handler) AdminUpdateRecipe(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID"})
		return
	}
	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
		ImageURL    *string `json:"image_url"`
		Position    int     `json:"position"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат"})
		return
	}
	recipe, err := h.catalogService.UpdateRecipe(c.Request.Context(), id, strings.TrimSpace(req.Name), req.Description, req.ImageURL, req.Position)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recipe)
}

// AdminDeleteRecipe удаляет рецепт.
func (h *Handler) AdminDeleteRecipe(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID"})
		return
	}
	if err := h.catalogService.DeleteRecipe(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AdminAddRecipeProduct добавляет ингредиент к рецепту.
func (h *Handler) AdminAddRecipeProduct(c *gin.Context) {
	recipeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID рецепта"})
		return
	}
	var req struct {
		ProductID string `json:"product_id"`
		Quantity  int    `json:"quantity"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный формат"})
		return
	}
	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный product_id"})
		return
	}
	qty := req.Quantity
	if qty < 1 {
		qty = 1
	}
	if err := h.catalogService.AddRecipeProduct(c.Request.Context(), recipeID, productID, qty); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AdminRemoveRecipeProduct убирает ингредиент из рецепта.
func (h *Handler) AdminRemoveRecipeProduct(c *gin.Context) {
	recipeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID рецепта"})
		return
	}
	productID, err := uuid.Parse(c.Param("product_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный product_id"})
		return
	}
	if err := h.catalogService.RemoveRecipeProduct(c.Request.Context(), recipeID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GetScenarios возвращает активные сценарии (публичный).
func (h *Handler) GetScenarios(c *gin.Context) {
	scenarios, err := h.catalogService.GetActiveScenarios(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, scenarios)
}

// AdminGetScenarios возвращает все сценарии (admin).
func (h *Handler) AdminGetScenarios(c *gin.Context) {
	scenarios, err := h.catalogService.GetAllScenarios(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, scenarios)
}

// AdminCreateScenario создаёт сценарий.
func (h *Handler) AdminCreateScenario(c *gin.Context) {
	var req struct {
		Label      string `json:"label"       binding:"required"`
		Subtitle   string `json:"subtitle"`
		SectionKey string `json:"section_key" binding:"required"`
		ImageURL   string `json:"image_url"`
		Emoji      string `json:"emoji"`
		Position   int    `json:"position"`
		IsActive   bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sc, err := h.catalogService.CreateScenario(c.Request.Context(), models.Scenario{
		Label: req.Label, Subtitle: req.Subtitle, SectionKey: req.SectionKey,
		ImageURL: req.ImageURL, Emoji: req.Emoji, Position: req.Position, IsActive: req.IsActive,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, sc)
}

// AdminUpdateScenario обновляет сценарий.
func (h *Handler) AdminUpdateScenario(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID"})
		return
	}
	var req struct {
		Label      string `json:"label"`
		Subtitle   string `json:"subtitle"`
		SectionKey string `json:"section_key"`
		ImageURL   string `json:"image_url"`
		Emoji      string `json:"emoji"`
		Position   int    `json:"position"`
		IsActive   bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	sc, err := h.catalogService.UpdateScenario(c.Request.Context(), id, models.Scenario{
		Label: req.Label, Subtitle: req.Subtitle, SectionKey: req.SectionKey,
		ImageURL: req.ImageURL, Emoji: req.Emoji, Position: req.Position, IsActive: req.IsActive,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sc)
}

// AdminDeleteScenario удаляет сценарий.
func (h *Handler) AdminDeleteScenario(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID"})
		return
	}
	if err := h.catalogService.DeleteScenario(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// ─── Store category meta ───────────────────────────────────────────────────────

func (h *Handler) GetStoreCategoryMeta(c *gin.Context) {
	items, err := h.catalogService.GetStoreCategoryMeta(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) AdminUpdateStoreCategoryImage(c *gin.Context) {
	categoryType := strings.ToUpper(c.Param("type"))
	validTypes := map[string]bool{"FOOD": true, "PHARMACY": true, "BUILDING": true, "HOME": true, "GROCERY": true, "SWEETS": true}
	if !validTypes[categoryType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный тип категории"})
		return
	}

	_ = c.Request.ParseMultipartForm(20 << 20)
	imageURL, err := h.saveUploadedImageCatalog(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if imageURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "файл изображения обязателен"})
		return
	}

	if err := h.catalogService.UpdateStoreCategoryImage(c.Request.Context(), categoryType, imageURL); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"image_url": imageURL})
}

var allowedMIMETypesCatalog = []struct {
	magic []byte
	ext   string
}{
	{[]byte{0xFF, 0xD8, 0xFF}, ".jpg"},
	{[]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, ".png"},
	{[]byte{0x47, 0x49, 0x46, 0x38}, ".gif"},
	{[]byte{0x52, 0x49, 0x46, 0x46}, ".webp"},
}

func (h *Handler) saveUploadedImageCatalog(c *gin.Context) (string, error) {
	fileHeader, err := c.FormFile("image")
	if err != nil {
		return "", nil
	}
	f, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("не удалось открыть файл")
	}
	defer f.Close()

	header := make([]byte, 12)
	if _, err := io.ReadFull(f, header); err != nil && err != io.ErrUnexpectedEOF {
		return "", fmt.Errorf("не удалось прочитать файл")
	}

	var ext string
	for _, t := range allowedMIMETypesCatalog {
		if len(header) >= len(t.magic) && bytes.Equal(header[:len(t.magic)], t.magic) {
			if t.ext == ".webp" {
				if len(header) >= 12 && string(header[8:12]) == "WEBP" {
					ext = ".webp"
					break
				}
				return "", fmt.Errorf("недопустимый тип файла")
			}
			ext = t.ext
			break
		}
	}
	if ext == "" {
		return "", fmt.Errorf("разрешены только JPEG, PNG, GIF, WebP")
	}

	if err := os.MkdirAll("uploads", 0o755); err != nil {
		return "", fmt.Errorf("не удалось подготовить папку загрузок")
	}
	fileName := uuid.NewString() + ext
	if err := c.SaveUploadedFile(fileHeader, filepath.Join("uploads", fileName)); err != nil {
		return "", fmt.Errorf("не удалось сохранить изображение")
	}

	base := h.uploadsBaseURL
	if base == "" {
		base = ""
	}
	return base + "/uploads/" + fileName, nil
}
