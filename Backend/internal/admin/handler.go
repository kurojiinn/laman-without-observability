package admin

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"os"
	"path/filepath"

	"Laman/internal/models"
	"Laman/internal/observability"
	"Laman/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// RecipeManager абстрагирует управление рецептами для admin-панели.
type RecipeManager interface {
	GetRecipes(ctx context.Context) ([]models.RecipeWithProducts, error)
	GetRecipe(ctx context.Context, id uuid.UUID) (*models.RecipeWithProducts, error)
	CreateRecipe(ctx context.Context, recipe *models.Recipe) error
	UpdateRecipe(ctx context.Context, id uuid.UUID, name string, description *string, imageURL *string, position int) (*models.Recipe, error)
	DeleteRecipe(ctx context.Context, id uuid.UUID) error
	AddRecipeProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID, quantity int) error
	RemoveRecipeProduct(ctx context.Context, recipeID uuid.UUID, productID uuid.UUID) error
}

// StoreCategoryImageUpdater обновляет данные типа магазина.
type StoreCategoryImageUpdater interface {
	UpdateStoreCategoryImage(ctx context.Context, categoryType string, imageURL string) error
	UpdateStoreCategoryMeta(ctx context.Context, categoryType string, name, description string) error
}

// ScenarioManager абстрагирует управление сценариями для admin-панели.
type ScenarioManager interface {
	GetAllScenarios(ctx context.Context) ([]models.Scenario, error)
	CreateScenario(ctx context.Context, s models.Scenario) (*models.Scenario, error)
	UpdateScenario(ctx context.Context, id uuid.UUID, s models.Scenario) (*models.Scenario, error)
	DeleteScenario(ctx context.Context, id uuid.UUID) error
}

// Handler принимает admin-запросы и проксирует их в сервис.
type Handler struct {
	service         *Service
	logger          *zap.Logger
	storage         storage.Provider
	recipes         RecipeManager
	storeCatUpdater StoreCategoryImageUpdater
	scenarios       ScenarioManager
}

// WithRecipes добавляет поддержку управления рецептами.
func (h *Handler) WithRecipes(rm RecipeManager) *Handler {
	h.recipes = rm
	return h
}

// WithStoreCategoryUpdater добавляет поддержку обновления фонов типов магазинов.
func (h *Handler) WithStoreCategoryUpdater(u StoreCategoryImageUpdater) *Handler {
	h.storeCatUpdater = u
	return h
}

// WithScenarios добавляет поддержку управления сценариями.
func (h *Handler) WithScenarios(sm ScenarioManager) *Handler {
	h.scenarios = sm
	return h
}

// NewHandler создает handler для admin-роутов.
func NewHandler(service *Service, logger *zap.Logger, store storage.Provider) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
		storage: store,
	}
}

// RegisterRoutes регистрирует admin-роуты под /api/v1/admin.
func (h *Handler) RegisterRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	admin := router.Group("/admin")
	admin.Use(authMiddleware)
	{
		admin.GET("/dashboard/stats", h.GetDashboardStats)
		admin.GET("/orders", h.GetAllOrders)
		admin.POST("/stores", h.CreateStore)
		admin.PATCH("/stores/:id", h.UpdateStore)
		admin.PATCH("/stores/:id/image", h.UpdateStoreImage)
		admin.DELETE("/stores/:id", h.DeleteStore)
		admin.GET("/products", h.GetProducts)
		admin.POST("/products", h.CreateProduct)
		admin.PATCH("/products/:id", h.UpdateProduct)
		admin.POST("/products/import", h.ImportProducts)
		admin.DELETE("/products/:id", h.DeleteProduct)
		admin.PATCH("/orders/:id", h.UpdateOrderStatus)
		// Витрина
		admin.GET("/featured", h.GetFeatured)
		admin.POST("/featured", h.AddFeatured)
		admin.DELETE("/featured/:id", h.DeleteFeatured)
		// Категории
		admin.GET("/categories", h.AdminGetCategories)
		admin.POST("/categories", h.AdminCreateCategory)
		admin.PATCH("/categories/:id", h.AdminUpdateCategory)
		admin.PATCH("/categories/:id/image", h.AdminUpdateCategoryImage)
		admin.DELETE("/categories/:id", h.AdminDeleteCategory)
		// Сборщики
		admin.GET("/pickers", h.GetPickers)
		admin.POST("/pickers", h.CreatePicker)
		admin.PATCH("/pickers/:id", h.UpdatePicker)
		admin.PATCH("/pickers/:id/password", h.UpdatePickerPassword)
		admin.DELETE("/pickers/:id", h.DeletePicker)
		// Фоны типов магазинов
		if h.storeCatUpdater != nil {
			admin.PATCH("/store-category-meta/:type", h.AdminUpdateStoreCategoryMeta)
			admin.PATCH("/store-category-meta/:type/image", h.AdminUpdateStoreCategoryImage)
		}
		// Сценарии
		if h.scenarios != nil {
			admin.GET("/scenarios", h.AdminGetScenarios)
			admin.POST("/scenarios", h.AdminCreateScenario)
			admin.PATCH("/scenarios/:id", h.AdminUpdateScenario)
			admin.DELETE("/scenarios/:id", h.AdminDeleteScenario)
		}
		// Рецепты
		if h.recipes != nil {
			admin.GET("/recipes", h.AdminGetRecipes)
			admin.GET("/recipes/:id", h.AdminGetRecipe)
			admin.POST("/recipes", h.AdminCreateRecipe)
			admin.PATCH("/recipes/:id", h.AdminUpdateRecipe)
			admin.DELETE("/recipes/:id", h.AdminDeleteRecipe)
			admin.POST("/recipes/:id/products", h.AdminAddRecipeProduct)
			admin.DELETE("/recipes/:id/products/:product_id", h.AdminRemoveRecipeProduct)
		}
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
	City         string                   `json:"city"`
	Phone        *string                  `json:"phone,omitempty"`
	Description  *string                  `json:"description,omitempty"`
	ImageURL     *string                  `json:"image_url,omitempty"`
	Rating       *float64                 `json:"rating,omitempty"`
	CategoryType models.StoreCategoryType `json:"category_type"`
	OpensAt      *string                  `json:"opens_at,omitempty"`
	ClosesAt     *string                  `json:"closes_at,omitempty"`
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

// GetAllOrders возвращает все заказы за последние 90 дней.
func (h *Handler) GetAllOrders(c *gin.Context) {
	orders, err := h.service.GetAllOrders(c.Request.Context())
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить заказы", err.Error())
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
// UpdateStore обновляет поля магазина.
// PATCH /api/v1/admin/stores/:id
func (h *Handler) UpdateStore(c *gin.Context) {
	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID магазина", "")
		return
	}
	var req struct {
		Name         string `json:"name"`
		Address      string `json:"address"`
		City         string `json:"city"`
		Description  string `json:"description"`
		CategoryType string `json:"category_type"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	if err := h.service.UpdateStore(c.Request.Context(), storeID, req.Name, req.Address, req.City, req.Description, models.StoreCategoryType(req.CategoryType)); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить магазин", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// UpdateStoreImage загружает новое фото магазина.
// PATCH /api/v1/admin/stores/:id/image
func (h *Handler) UpdateStoreImage(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.update_store_image")
	defer span.End()

	storeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID магазина", "")
		return
	}
	_ = c.Request.ParseMultipartForm(20 << 20)
	imageURL, err := h.saveUploadedImage(ctx, c)
	if err != nil || imageURL == "" {
		h.respondError(c, http.StatusBadRequest, "изображение обязательно", "")
		return
	}
	if err := h.service.repo.UpdateStoreImage(ctx, storeID, imageURL); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить фото", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"image_url": imageURL})
}

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

// GetProducts возвращает список товаров магазина.
func (h *Handler) GetProducts(c *gin.Context) {
	storeID, err := uuid.Parse(c.Query("store_id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "требуется store_id", "")
		return
	}
	products, err := h.service.GetProductsByStore(c.Request.Context(), storeID)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить товары", err.Error())
		return
	}
	c.JSON(http.StatusOK, products)
}

// UpdateProduct обновляет товар. Принимает multipart/form-data (поля + опциональное фото).
func (h *Handler) UpdateProduct(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.update_product")
	defer span.End()

	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID товара", "")
		return
	}

	_ = c.Request.ParseMultipartForm(20 << 20)

	req := &UpdateProductRequest{}

	if name := c.PostForm("name"); name != "" {
		req.Name = &name
	}
	if priceStr := c.PostForm("price"); priceStr != "" {
		var price float64
		if _, err := fmt.Sscanf(priceStr, "%f", &price); err == nil && price > 0 {
			req.Price = &price
		}
	}
	if desc := c.PostForm("description"); desc != "" {
		req.Description = &desc
	}
	if availStr := c.PostForm("is_available"); availStr != "" {
		avail := availStr == "true"
		req.IsAvailable = &avail
	}
	if catStr := c.PostForm("category_id"); catStr != "" {
		if catID, err := uuid.Parse(catStr); err == nil {
			req.CategoryID = &catID
		}
	}

	// Если загружено новое фото — сохраняем и обновляем URL
	if _, fileHeader, err := c.Request.FormFile("image"); err == nil && fileHeader != nil {
		imageURL, err := h.saveUploadedImage(ctx, c)
		if err == nil {
			req.ImageURL = &imageURL
		}
	}

	product, err := h.service.UpdateProduct(ctx, productID, req)
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "не удалось обновить товар", err.Error())
		return
	}
	c.JSON(http.StatusOK, product)
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

// importAllowedExts — разрешённые расширения и их магические байты.
// CSV не имеет магических байтов — принимаем по расширению.
var importAllowedExts = map[string][]byte{
	".xlsx": {0x50, 0x4B, 0x03, 0x04}, // ZIP/PK — формат Open XML
	".xlsm": {0x50, 0x4B, 0x03, 0x04},
	".xls":  {0xD0, 0xCF, 0x11, 0xE0}, // OLE2 compound document
	".csv":  nil,                        // plain text, без магических байтов
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

	// Ограничение размера импорт-файла.
	const maxImportSize = 5 << 20 // 5 MB
	if fileHeader.Size > maxImportSize {
		h.respondError(c, http.StatusBadRequest, "файл слишком большой", "максимальный размер 5 МБ")
		return
	}

	// Проверяем расширение и магические байты — не доверяем имени файла.
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	magic, allowed := importAllowedExts[ext]
	if !allowed {
		h.respondError(c, http.StatusBadRequest, "недопустимый тип файла", "разрешены только .xlsx, .xls, .csv")
		return
	}
	if magic != nil {
		f, openErr := fileHeader.Open()
		if openErr != nil {
			h.respondError(c, http.StatusBadRequest, "не удалось открыть файл", openErr.Error())
			return
		}
		hdr := make([]byte, len(magic))
		_, _ = io.ReadFull(f, hdr)
		_ = f.Close()
		if !bytes.Equal(hdr, magic) {
			h.respondError(c, http.StatusBadRequest, "недопустимый тип файла", "содержимое не соответствует расширению "+ext)
			return
		}
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

// allowedMIMETypes содержит разрешённые сигнатуры магических байтов изображений.
var allowedMIMETypes = []struct {
	magic []byte
	ext   string
}{
	{[]byte{0xFF, 0xD8, 0xFF}, ".jpg"},
	{[]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, ".png"},
	{[]byte{0x47, 0x49, 0x46, 0x38}, ".gif"},
	{[]byte{0x52, 0x49, 0x46, 0x46}, ".webp"}, // RIFF prefix — webp дополнительно проверяется ниже
}

// detectImageExt определяет расширение файла по магическим байтам.
// Возвращает ошибку, если файл не является допустимым изображением.
func detectImageExt(header []byte) (string, error) {
	for _, t := range allowedMIMETypes {
		if len(header) >= len(t.magic) && bytes.Equal(header[:len(t.magic)], t.magic) {
			// Дополнительная проверка WebP: RIFF????WEBP
			if t.ext == ".webp" {
				if len(header) >= 12 && string(header[8:12]) == "WEBP" {
					return ".webp", nil
				}
				return "", fmt.Errorf("недопустимый тип файла")
			}
			return t.ext, nil
		}
	}
	return "", fmt.Errorf("недопустимый тип файла: разрешены только JPEG, PNG, GIF, WebP")
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

	// Проверяем MIME-тип по магическим байтам (не доверяем расширению из имени файла).
	f, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("не удалось открыть файл")
	}
	defer f.Close()

	header := make([]byte, 12)
	if _, err := io.ReadFull(f, header); err != nil && err != io.ErrUnexpectedEOF {
		return "", fmt.Errorf("не удалось прочитать файл")
	}

	ext, err := detectImageExt(header)
	if err != nil {
		return "", err
	}

	// Читаем весь файл для загрузки в MinIO.
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("не удалось прочитать файл")
	}
	data, err := io.ReadAll(f)
	if err != nil {
		return "", fmt.Errorf("не удалось прочитать файл")
	}

	contentType := extToContentType(ext)
	key := uuid.NewString() + ext

	h.logger.Info("Загрузка изображения: отправка в хранилище",
		zap.String("filename", fileHeader.Filename),
		zap.String("key", key),
	)

	url, err := h.storage.Upload(ctx, key, contentType, data)
	if err != nil {
		h.logger.Error("Загрузка изображения: ошибка загрузки в хранилище", zap.Error(err))
		return "", fmt.Errorf("не удалось сохранить изображение")
	}

	uploadsTotal.Inc()
	h.logger.Info("Загрузка изображения: успешно", zap.String("url", url))

	return url, nil
}

func extToContentType(ext string) string {
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}

// ─── Scenario admin handlers ──────────────────────────────────────────────────

func (h *Handler) AdminGetScenarios(c *gin.Context) {
	items, err := h.scenarios.GetAllScenarios(c.Request.Context())
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить сценарии", err.Error())
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) AdminCreateScenario(c *gin.Context) {
	var s models.Scenario
	if err := c.ShouldBindJSON(&s); err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный формат", err.Error())
		return
	}
	created, err := h.scenarios.CreateScenario(c.Request.Context(), s)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось создать сценарий", err.Error())
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *Handler) AdminUpdateScenario(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID", "")
		return
	}
	var s models.Scenario
	if err := c.ShouldBindJSON(&s); err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный формат", err.Error())
		return
	}
	updated, err := h.scenarios.UpdateScenario(c.Request.Context(), id, s)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить сценарий", err.Error())
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *Handler) AdminDeleteScenario(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID", "")
		return
	}
	if err := h.scenarios.DeleteScenario(c.Request.Context(), id); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось удалить сценарий", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// AdminUpdateStoreCategoryMeta обновляет название и описание типа магазина.
// PATCH /api/v1/admin/store-category-meta/:type
func (h *Handler) AdminUpdateStoreCategoryMeta(c *gin.Context) {
	categoryType := strings.ToUpper(c.Param("type"))
	validTypes := map[string]bool{"FOOD": true, "PHARMACY": true, "BUILDING": true, "HOME": true, "GROCERY": true, "SWEETS": true}
	if !validTypes[categoryType] {
		h.respondError(c, http.StatusBadRequest, "неверный тип категории", "")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	if err := h.storeCatUpdater.UpdateStoreCategoryMeta(c.Request.Context(), categoryType, req.Name, req.Description); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить категорию", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// AdminUpdateStoreCategoryImage обновляет фоновое изображение типа магазина.
func (h *Handler) AdminUpdateStoreCategoryImage(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.update_store_category_image")
	defer span.End()

	categoryType := strings.ToUpper(c.Param("type"))
	validTypes := map[string]bool{"FOOD": true, "PHARMACY": true, "BUILDING": true, "HOME": true, "GROCERY": true, "SWEETS": true}
	if !validTypes[categoryType] {
		h.respondError(c, http.StatusBadRequest, "неверный тип категории", "")
		return
	}

	_ = c.Request.ParseMultipartForm(20 << 20)
	imageURL, err := h.saveUploadedImage(ctx, c)
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "не удалось сохранить изображение", err.Error())
		return
	}
	if imageURL == "" {
		h.respondError(c, http.StatusBadRequest, "файл изображения обязателен", "")
		return
	}

	if err := h.storeCatUpdater.UpdateStoreCategoryImage(ctx, categoryType, imageURL); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить изображение", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"image_url": imageURL})
}

// ─── Category admin handlers ──────────────────────────────────────────────────

func (h *Handler) AdminGetCategories(c *gin.Context) {
	cats, err := h.service.GetCategories(c.Request.Context())
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить категории", err.Error())
		return
	}
	c.JSON(http.StatusOK, cats)
}

func (h *Handler) AdminCreateCategory(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.create_category")
	defer span.End()

	_ = c.Request.ParseMultipartForm(20 << 20)
	name := strings.TrimSpace(c.PostForm("name"))
	if name == "" {
		h.respondError(c, http.StatusBadRequest, "name обязателен", "")
		return
	}

	var imageURL *string
	if url, err := h.saveUploadedImage(ctx, c); err == nil && url != "" {
		imageURL = &url
	}

	cat, err := h.service.CreateCategory(ctx, name, imageURL)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось создать категорию", err.Error())
		return
	}
	c.JSON(http.StatusCreated, cat)
}

// AdminUpdateCategory обновляет название категории товаров.
// PATCH /api/v1/admin/categories/:id
func (h *Handler) AdminUpdateCategory(c *gin.Context) {
	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID категории", "")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		h.respondError(c, http.StatusBadRequest, "name обязателен", "")
		return
	}
	if err := h.service.UpdateCategoryName(c.Request.Context(), catID, strings.TrimSpace(req.Name)); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить категорию", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) AdminUpdateCategoryImage(c *gin.Context) {
	ctx, span := observability.StartSpan(c.Request.Context(), "admin.update_category_image")
	defer span.End()

	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID категории", "")
		return
	}

	_ = c.Request.ParseMultipartForm(20 << 20)
	imageURL, err := h.saveUploadedImage(ctx, c)
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "не удалось сохранить изображение", err.Error())
		return
	}
	if imageURL == "" {
		h.respondError(c, http.StatusBadRequest, "файл изображения обязателен", "")
		return
	}

	if err := h.service.UpdateCategoryImage(ctx, catID, imageURL); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось обновить изображение", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"image_url": imageURL})
}

func (h *Handler) AdminDeleteCategory(c *gin.Context) {
	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID категории", "")
		return
	}
	if err := h.service.DeleteCategory(c.Request.Context(), catID); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось удалить категорию", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// respondError возвращает единый формат ошибок для админки.
func (h *Handler) respondError(c *gin.Context, status int, message string, details string) {
	payload := gin.H{"error": message}
	if details != "" {
		payload["details"] = details
	}
	c.JSON(status, payload)
}

// ── Витрина ────────────────────────────────────────────────────────────────────

type AddFeaturedRequest struct {
	ProductID uuid.UUID               `json:"product_id"`
	BlockType models.FeaturedBlockType `json:"block_type"`
	Position  int                     `json:"position"`
}

// GetFeatured возвращает список записей витрины по блоку.
// GET /api/v1/admin/featured?block=new_items
func (h *Handler) GetFeatured(c *gin.Context) {
	blockType := models.FeaturedBlockType(c.Query("block"))
	if !isValidFeaturedBlock(blockType) {
		h.respondError(c, http.StatusBadRequest, "неверный тип блока", "допустимы: new_items, hits, movie_night")
		return
	}
	items, err := h.service.repo.GetFeaturedList(c.Request.Context(), blockType)
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "ошибка получения витрины", err.Error())
		return
	}
	c.JSON(http.StatusOK, items)
}

// AddFeatured добавляет товар в блок витрины.
// POST /api/v1/admin/featured
func (h *Handler) AddFeatured(c *gin.Context) {
	var req AddFeaturedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный запрос", err.Error())
		return
	}
	if !isValidFeaturedBlock(req.BlockType) {
		h.respondError(c, http.StatusBadRequest, "неверный тип блока", "допустимы: new_items, hits, movie_night")
		return
	}
	fp := &models.FeaturedProduct{
		ID:        uuid.New(),
		ProductID: req.ProductID,
		BlockType: req.BlockType,
		Position:  req.Position,
		CreatedAt: time.Now(),
	}
	if err := h.service.repo.AddFeatured(c.Request.Context(), fp); err != nil {
		h.respondError(c, http.StatusInternalServerError, "ошибка добавления", err.Error())
		return
	}
	c.JSON(http.StatusCreated, fp)
}

// DeleteFeatured удаляет товар из блока витрины.
// DELETE /api/v1/admin/featured/:id
func (h *Handler) DeleteFeatured(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID", "")
		return
	}
	if err := h.service.repo.DeleteFeatured(c.Request.Context(), id); err != nil {
		h.respondError(c, http.StatusNotFound, "запись не найдена", err.Error())
		return
	}
	c.Status(http.StatusNoContent)
}

func isValidFeaturedBlock(bt models.FeaturedBlockType) bool {
	switch bt {
	case models.FeaturedBlockNewItems, models.FeaturedBlockHits, models.FeaturedBlockMovieNight,
		models.FeaturedBlockQuickSnack, models.FeaturedBlockLazyCook:
		return true
	}
	return false
}

// ─── Recipe admin handlers ────────────────────────────────────────────────────

func (h *Handler) AdminGetRecipes(c *gin.Context) {
	recipes, err := h.recipes.GetRecipes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recipes)
}

func (h *Handler) AdminGetRecipe(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID рецепта"})
		return
	}
	recipe, err := h.recipes.GetRecipe(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recipe)
}

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
		storeID, err := uuid.Parse(*req.StoreID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "неверный store_id"})
			return
		}
		recipe.StoreID = &storeID
	}
	if err := h.recipes.CreateRecipe(c.Request.Context(), recipe); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, recipe)
}

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
	recipe, err := h.recipes.UpdateRecipe(c.Request.Context(), id, strings.TrimSpace(req.Name), req.Description, req.ImageURL, req.Position)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recipe)
}

func (h *Handler) AdminDeleteRecipe(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "неверный ID"})
		return
	}
	if err := h.recipes.DeleteRecipe(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

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
	if err := h.recipes.AddRecipeProduct(c.Request.Context(), recipeID, productID, qty); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

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
	if err := h.recipes.RemoveRecipeProduct(c.Request.Context(), recipeID, productID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// GetPickers возвращает список сборщиков с их магазинами.
func (h *Handler) GetPickers(c *gin.Context) {
	pickers, err := h.service.GetPickers(c.Request.Context())
	if err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось получить сборщиков", err.Error())
		return
	}
	c.JSON(http.StatusOK, pickers)
}

// CreatePicker создаёт сборщика, привязанного к магазину.
func (h *Handler) CreatePicker(c *gin.Context) {
	var req CreatePickerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	picker, err := h.service.CreatePicker(c.Request.Context(), &req)
	if err != nil {
		h.respondError(c, http.StatusBadRequest, err.Error(), "")
		return
	}
	c.JSON(http.StatusCreated, picker)
}

// UpdatePicker меняет магазин сборщика.
func (h *Handler) UpdatePicker(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID", err.Error())
		return
	}
	var req struct {
		StoreID uuid.UUID `json:"store_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	if err := h.service.UpdatePickerStore(c.Request.Context(), id, req.StoreID); err != nil {
		h.respondError(c, http.StatusBadRequest, err.Error(), "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// UpdatePickerPassword меняет пароль сборщика.
func (h *Handler) UpdatePickerPassword(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID", err.Error())
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, http.StatusBadRequest, "некорректные данные", err.Error())
		return
	}
	if err := h.service.UpdatePickerPassword(c.Request.Context(), id, req.Password); err != nil {
		h.respondError(c, http.StatusBadRequest, err.Error(), "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DeletePicker удаляет сборщика по ID.
func (h *Handler) DeletePicker(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		h.respondError(c, http.StatusBadRequest, "неверный ID", err.Error())
		return
	}
	if err := h.service.DeletePicker(c.Request.Context(), id); err != nil {
		h.respondError(c, http.StatusInternalServerError, "не удалось удалить сборщика", err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
