package admin

import (
	"context"
	"fmt"
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

// Handler принимает admin-запросы и проксирует их в сервис.
type Handler struct {
	service        *Service
	logger         *zap.Logger
	uploadsBaseURL string
}

// NewHandler создает handler для admin-роутов.
func NewHandler(service *Service, logger *zap.Logger, uploadsBaseURL string) *Handler {
	return &Handler{
		service:        service,
		logger:         logger,
		uploadsBaseURL: strings.TrimRight(uploadsBaseURL, "/"),
	}
}

// RegisterRoutes регистрирует admin-роуты под /api/v1/admin.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	admin := router.Group("/admin")
	admin.Use(authMiddleware)
	{
		admin.GET("/dashboard/stats", h.GetDashboardStats)
		admin.GET("/orders/active", h.GetActiveOrders)
		admin.POST("/stores", h.CreateStore)
		admin.DELETE("/stores/:id", h.DeleteStore)
		admin.POST("/products", h.CreateProduct)
		admin.POST("/products/import", h.ImportProducts)
		admin.DELETE("/products/:id", h.DeleteProduct)
		admin.PATCH("/orders/:id", h.UpdateOrderStatus)
	}
}

type DashboardStats struct {
	TotalRegisteredUsers int     `json:"total_registered_users"`
	TotalGuests          int     `json:"total_guests"`
	ActiveOrdersCount    int     `json:"active_orders_count"`
	TodayRevenue         float64 `json:"today_revenue"`
}

// CreateStoreRequest описывает payload для создания магазина.
type CreateStoreRequest struct {
	Name         string                   `json:"name"`
	Address      string                   `json:"address"`
	Phone        *string                  `json:"phone,omitempty"`
	Description  *string                  `json:"description,omitempty"`
	ImageURL     *string                  `json:"image_url,omitempty"`
	Rating       *float64                 `json:"rating,omitempty"`
	CategoryType models.StoreCategoryType `json:"category_type"`
}

// CreateProductRequest описывает payload для создания товара.
// Используется как внутренний DTO, независимо от формата входящего запроса.
type CreateProductRequest struct {
	StoreID       uuid.UUID  `json:"store_id"`
	CategoryID    uuid.UUID  `json:"category_id"`
	SubcategoryID *uuid.UUID `json:"subcategory_id,omitempty"`
	Name          string     `json:"name"`
	Description   *string    `json:"description,omitempty"`
	ImageURL      *string    `json:"image_url,omitempty"`
	Price         float64    `json:"price"`
	Weight        *float64   `json:"weight,omitempty"`
	IsAvailable   *bool      `json:"is_available,omitempty"`
}

// UpdateOrderStatusRequest описывает обновление статуса заказа.
type UpdateOrderStatusRequest struct {
	Status string `json:"status"`
}

// GetDashboardStats возвращает агрегированную статистику для dashboard.
func (h *Handler) GetDashboardStats(c *gin.Context) {
	stats, err := h.service.GetDashboardStats(c.Request.Context())
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить статистику", err.Error())
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetActiveOrders возвращает заказы со статусом, отличным от DELIVERED.
func (h *Handler) GetActiveOrders(c *gin.Context) {
	orders, err := h.service.GetActiveOrders(c.Request.Context())
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить активные заказы", err.Error())
		return
	}

	c.JSON(http.StatusOK, orders)
}

// CreateStore создает магазин и возвращает его.
func (h *Handler) CreateStore(c *gin.Context) {
	var req CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	if req.Name == "" || req.Address == "" || req.CategoryType == "" {
		h.respondError(c, http.StatusBadRequest, "имя, адрес и category_type обязательны", "")
		return
	}

	store, err := h.service.CreateStore(c.Request.Context(), &req)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось создать магазин", err.Error())
		return
	}

	c.JSON(http.StatusCreated, store)
}

// CreateProduct создает товар и возвращает его.
func (h *Handler) CreateProduct(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.create_product")
	defer span.End()

	// Обрабатываем multipart/form-data, так как изображение приходит файлом.
	if err := c.Request.ParseMultipartForm(20 << 20); err != nil {
		h.respondError(c, http.StatusBadRequest, "не удалось разобрать форму", err.Error())
		return
	}

	req, err := h.buildCreateProductRequestFromForm(ctx, c)
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}

	if req.Name == "" || req.StoreID == uuid.Nil || req.CategoryID == uuid.Nil {
		h.respondError(c, http.StatusBadRequest, "name, store_id и category_id обязательны", "")
		return
	}
	if req.Price <= 0 {
		h.respondError(c, http.StatusBadRequest, "price должен быть больше 0", "")
		return
	}

	product, err := h.service.CreateProduct(ctx, &req)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось создать товар", err.Error())
		return
	}

	c.JSON(http.StatusCreated, product)
}

// DeleteStore удаляет магазин по ID.
func (h *Handler) DeleteStore(c *gin.Context) {
	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID магазина", "")
		return
	}

	if err := h.service.DeleteStore(c.Request.Context(), storeID); err != nil {
		h.respondError(c, http.StatusBadRequest, "не удалось удалить магазин", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// DeleteProduct удаляет товар по ID.
func (h *Handler) DeleteProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID товара", "")
		return
	}

	if err := h.service.DeleteProduct(c.Request.Context(), productID); err != nil {
		h.respondError(c, http.StatusBadRequest, "не удалось удалить товар", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// UpdateOrderStatus обновляет статус заказа.
func (h *Handler) UpdateOrderStatus(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID заказа", "")
		return
	}

	var req UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	if req.Status == "" {
		h.respondError(c, http.StatusBadRequest, "status обязателен", "")
		return
	}

	if err := h.service.UpdateOrderStatus(c.Request.Context(), orderID, req.Status); err != nil {
		statusCode := http.StatusInternalServerError
		if err == errInvalidStatus {
			statusCode = http.StatusBadRequest
		}
		h.respondError(c, statusCode, "не удалось обновить статус", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// ImportProducts принимает Excel/CSV файл и выполняет массовый импорт.
func (h *Handler) ImportProducts(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.import_products")
	defer span.End()

	start := time.Now()
	fileHeader, err := c.FormFile("file")
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "файл не найден", err.Error())
		return
	}

	h.logger.Info("Импорт товаров: старт загрузки файла",
		zap.String("filename", fileHeader.Filename),
		zap.Int64("size", fileHeader.Size),
	)

	tempDir := os.TempDir()
	tempPath := filepath.Join(tempDir, fmt.Sprintf("import_%s%s", uuid.NewString(), filepath.Ext(fileHeader.Filename)))
	if err := c.SaveUploadedFile(fileHeader, tempPath); err != nil {
		h.logger.Error("Импорт товаров: не удалось сохранить файл", zap.Error(err))
		h.respondError(c, http.StatusInternalServerError, "не удалось сохранить файл", err.Error())
		return
	}
	defer func() {
		_ = os.Remove(tempPath)
	}()

	h.logger.Info("Импорт товаров: файл сохранен", zap.String("path", tempPath))

	result, err := h.service.ImportProducts(ctx, tempPath, fileHeader.Filename)
	if err != nil {
		h.logger.Error("Импорт товаров: ошибка", zap.Error(err))
		h.respondError(c, http.StatusBadRequest, "ошибка импорта", err.Error())
		return
	}

	importProductsDuration.Observe(time.Since(start).Seconds())
	h.logger.Info("Импорт товаров: успешно завершен", zap.Int("created", result.Inserted))

	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"inserted": result.Inserted,
	})
}

// buildCreateProductRequestFromForm собирает CreateProductRequest из multipart/form-data.
func (h *Handler) buildCreateProductRequestFromForm(ctx context.Context, c *gin.Context) (CreateProductRequest, error) {
	var req CreateProductRequest

	storeID, err := uuid.Parse(c.PostForm("store_id"))
	if err != nil {
		return req, fmt.Errorf("некорректный store_id")
	}
	categoryID, err := uuid.Parse(c.PostForm("category_id"))
	if err != nil {
		return req, fmt.Errorf("некорректный category_id")
	}

	req.StoreID = storeID
	req.CategoryID = categoryID
	req.Name = strings.TrimSpace(c.PostForm("name"))
	if req.Name == "" {
		return req, fmt.Errorf("name обязателен")
	}

	if subcategory := strings.TrimSpace(c.PostForm("subcategory_id")); subcategory != "" {
		subID, err := uuid.Parse(subcategory)
		if err != nil {
			return req, fmt.Errorf("некорректный subcategory_id")
		}
		req.SubcategoryID = &subID
	}

	if description := strings.TrimSpace(c.PostForm("description")); description != "" {
		req.Description = &description
	}

	priceValue := strings.TrimSpace(c.PostForm("price"))
	priceValue = strings.ReplaceAll(priceValue, ",", ".")
	price, err := strconv.ParseFloat(priceValue, 64)
	if err != nil {
		return req, fmt.Errorf("некорректный формат price")
	}
	req.Price = price

	if weightValue := strings.TrimSpace(c.PostForm("weight")); weightValue != "" {
		weightValue = strings.ReplaceAll(weightValue, ",", ".")
		weight, err := strconv.ParseFloat(weightValue, 64)
		if err != nil {
			return req, fmt.Errorf("некорректный формат weight")
		}
		req.Weight = &weight
	}

	if isAvailableValue := strings.TrimSpace(c.PostForm("is_available")); isAvailableValue != "" {
		parsed, err := strconv.ParseBool(isAvailableValue)
		if err != nil {
			return req, fmt.Errorf("некорректный формат is_available")
		}
		req.IsAvailable = &parsed
	}

	imageURL, err := h.saveUploadedImage(ctx, c)
	if err != nil {
		return req, err
	}
	if imageURL != "" {
		req.ImageURL = &imageURL
	}

	return req, nil
}

// saveUploadedImage сохраняет файл изображения и возвращает публичный URL.
func (h *Handler) saveUploadedImage(ctx context.Context, c *gin.Context) (string, error) {
	_, span := observability.StartSpan(ctx, "admin.save_product_image")
	defer span.End()

	fileHeader, err := c.FormFile("image")
	if err != nil {
		// Изображение опционально, поэтому если файла нет — возвращаем пустую строку.
		return "", nil
	}

	if err := os.MkdirAll("uploads", 0o755); err != nil {
		h.logger.Error("Не удалось создать папку uploads", zap.Error(err))
		return "", fmt.Errorf("не удалось подготовить папку загрузок")
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	fileName := fmt.Sprintf("%s%s", uuid.NewString(), ext)
	targetPath := filepath.Join("uploads", fileName)

	h.logger.Info("Загрузка изображения: сохранение файла",
		zap.String("filename", fileHeader.Filename),
		zap.String("target", targetPath),
	)

	if err := c.SaveUploadedFile(fileHeader, targetPath); err != nil {
		h.logger.Error("Загрузка изображения: ошибка сохранения", zap.Error(err))
		return "", fmt.Errorf("не удалось сохранить изображение")
	}

	uploadsTotal.Inc()
	h.logger.Info("Загрузка изображения: успешно",
		zap.String("url", h.uploadsBaseURL+"/uploads/"+fileName),
	)

	return h.uploadsBaseURL + "/uploads/" + fileName, nil
}

// respondError возвращает единый формат ошибок для админки.
func (h *Handler) respondError(c *gin.Context, status int, message string, details string) {
	payload := gin.H{"error": message}
	if details != "" {
		payload["details"] = details
	}
	c.JSON(status, payload)
}
