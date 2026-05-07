package main

import (
	"Laman/internal/cache"
	"Laman/internal/events"
	"Laman/internal/picker"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"Laman/internal/admin"
	"Laman/internal/auth"
	"Laman/internal/catalog"
	"Laman/internal/config"
	"Laman/internal/database"
	"Laman/internal/delivery"
	"Laman/internal/favorites"
	"Laman/internal/middleware"
	"Laman/internal/observability"
	"Laman/internal/orders"
	"Laman/internal/payments"
	"Laman/internal/push"
	"Laman/internal/storage"
	"Laman/internal/users"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	gin.SetMode(gin.ReleaseMode)

	// Загрузка конфигурации
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Не удалось загрузить конфигурацию: %v", err)
	}

	// Инициализация логгера
	logger, err := observability.InitLogger()
	if err != nil {
		log.Fatalf("Не удалось инициализировать логгер: %v", err)
	}
	defer func() { _ = logger.Sync() }()

	// Инициализация базы данных
	db, err := database.New(&cfg.Database)
	if err != nil {
		logger.Fatal("Не удалось подключиться к базе данных", zap.Error(err))
	}
	defer func() { _ = db.Close() }()

	// Инициализация кэша Redis
	redisClient, err := cache.New(&cfg.Redis)
	if err != nil {
		logger.Fatal("Не удалось подключиться к Redis", zap.Error(err))
	}

	defer func() { _ = redisClient.Close() }()

	// Инициализация Telegram уведомлений (опционально)
	var telegramNotifier *observability.TelegramNotifier
	if cfg.Telegram.BotToken != "" && cfg.Telegram.ChatID != "" {
		notifier, err := observability.NewTelegramNotifier(cfg.Telegram.BotToken, cfg.Telegram.ChatID)
		if err != nil {
			logger.Warn("Telegram уведомления отключены", zap.Error(err))
		} else {
			telegramNotifier = notifier
		}
	} else {
		logger.Warn("Telegram уведомления отключены: TG_BOT_TOKEN или TG_CHAT_ID не задан")
	}

	if strings.TrimSpace(cfg.SMS.RuAPIKey) == "" {
		logger.Warn("SMS звонки отключены: задайте SMS_RU_KEY (или SMSRU_API_KEY)")
	}

	// Инициализация репозиториев
	authRepo := auth.NewPostgresAuthRepository(db)
	userRepo := users.NewPostgresUserRepository(db)
	categoryRepo := catalog.NewPostgresCategoryRepository(db)
	subcategoryRepo := catalog.NewPostgresSubcategoryRepository(db)
	productRepo := catalog.NewPostgresProductRepository(db)
	storeRepo := catalog.NewPostgresStoreRepository(db)
	reviewRepo := catalog.NewPostgresReviewRepository(db)
	featuredRepo := catalog.NewPostgresFeaturedProductRepository(db)
	recipeRepo := catalog.NewPostgresRecipeRepository(db)
	scenarioRepo := catalog.NewPostgresScenarioRepository(db)
	storeCatMetaRepo := catalog.NewPostgresStoreCategoryMetaRepository(db)
	orderRepo := orders.NewPostgresOrderRepository(db)
	orderItemRepo := orders.NewPostgresOrderItemRepository(db)
	paymentRepo := payments.NewPostgresPaymentRepository(db)
	deliveryRepo := delivery.NewPostgresDeliveryRepository(db)
	pickerRepo := picker.NewPostgresPikerRepository(db)
	favoritesRepo := favorites.NewPostgresRepository(db)

	hub := events.NewHub()
	// Инициализация сервисов
	smsProvider := auth.NewSMSRUProvider(cfg.SMS.RuAPIKey, cfg.SMS.TestMode, logger)
	emailSender := auth.NewSMTPEmailSender(cfg.Email.Host, cfg.Email.Port, cfg.Email.Login, cfg.Email.Password, cfg.Email.From, logger)

	otpLimiter := auth.NewRedisOTPLimiter(redisClient.Client(), 5, 15*time.Minute, cache.OTPAttemptsKey)
	sendCodeLimiter := auth.NewRedisOTPLimiter(redisClient.Client(), 3, 10*time.Minute, cache.OTPSendKey)
	// checkUserLimiter: 20 запросов в минуту по IP — защита от перебора номеров
	checkUserLimiter := auth.NewRedisOTPLimiter(redisClient.Client(), 20, 1*time.Minute, cache.CheckUserIPKey)
	pickerLoginLimiter := auth.NewRedisOTPLimiter(redisClient.Client(), 10, 30*time.Minute, "picker:login:%s")
	tokenRevoker := auth.NewRedisTokenRevoker(redisClient.Client())
	authService := auth.NewAuthService(
		authRepo,
		userRepo,
		cfg.JWT.Secret,
		smsProvider,
		emailSender,
		logger,
		otpLimiter,
		sendCodeLimiter,
		tokenRevoker,
		cfg.SMS.TestMode,
		telegramNotifier,
	)
	userService := users.NewUserService(userRepo)
	catalogService := catalog.NewCatalogService(categoryRepo, subcategoryRepo, productRepo, storeRepo, reviewRepo, featuredRepo, recipeRepo, scenarioRepo, storeCatMetaRepo).
		WithCache(redisClient.Client())
	pushService := push.NewService(db.DB.DB, logger, cfg.VAPID.PublicKey, cfg.VAPID.PrivateKey, cfg.VAPID.Email)
	orderService := orders.NewOrderService(
		db,
		orderRepo,
		orderItemRepo,
		productRepo,
		deliveryRepo,
		paymentRepo,
		5.0,   // 5% сервисный сбор
		200.0, // 200 руб. стоимость доставки
		telegramNotifier,
		pushService,
		logger,
		hub,
	)
	pickerService := picker.NewPickerService(pickerRepo, userRepo, cfg.JWT.Secret, 5.0, logger)
	favoritesService := favorites.NewService(favoritesRepo, logger)

	// Инициализация обработчиков
	authHandler := auth.NewHandler(authService, logger, cfg.Server.CookieSecure, checkUserLimiter)
	userHandler := users.NewHandler(userService, authService)
	catalogHandler := catalog.NewHandler(catalogService, logger).WithAuth(authService).WithUploadsBaseURL(cfg.Server.PublicURL)
	orderHandler := orders.NewHandler(orderService, authService, hub)
	minioProvider, err := storage.NewMinIOProvider(
		cfg.MinIO.Endpoint,
		cfg.MinIO.PublicURL,
		cfg.MinIO.AccessKey,
		cfg.MinIO.SecretKey,
		cfg.MinIO.Bucket,
		cfg.MinIO.UseSSL,
	)
	if err != nil {
		logger.Fatal("Не удалось подключиться к MinIO", zap.Error(err))
	}

	adminRepo := admin.NewPostgresRepository(db)
	adminService := admin.NewService(adminRepo, logger, pushService)
	adminHandler := admin.NewHandler(adminService, logger, minioProvider).WithRecipes(catalogService).WithStoreCategoryUpdater(catalogService).WithScenarios(catalogService)
	pickerHandler := picker.NewHandler(pickerService, logger, authService, hub, pickerLoginLimiter)
	favoritesHandler := favorites.NewHandler(favoritesService, authService, logger)
	pushHandler := push.NewHandler(pushService, authService)

	// Настройка роутера
	router := setupRouter(logger, cfg, authService, authHandler, userHandler, catalogHandler, orderHandler, adminHandler, pickerHandler, favoritesHandler, pushHandler)

	// Настройка health check
	router.GET("/health", func(c *gin.Context) {
		ctx := c.Request.Context()
		if err := db.PingContext(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "db": err.Error()})
			return
		}
		if err := redisClient.Client().Ping(ctx).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "redis": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Создание HTTP сервера
	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Запуск сервера в горутине
	go func() {
		logger.Info("Запуск сервера", zap.String("address", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Не удалось запустить сервер", zap.Error(err))
		}
	}()

	// Ожидание сигнала прерывания
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Остановка сервера...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("Сервер принудительно остановлен", zap.Error(err))
	}

	logger.Info("Сервер остановлен")
}

func setupRouter(
	logger *zap.Logger,
	cfg *config.Config,
	authService middleware.TokenValidator,
	authHandler *auth.Handler,
	userHandler *users.Handler,
	catalogHandler *catalog.Handler,
	orderHandler *orders.Handler,
	adminHandler *admin.Handler,
	pickerHandler *picker.Handler,
	favoritesHandler *favorites.Handler,
	pushHandler *push.Handler,
) *gin.Engine {
	router := gin.New()
	// nginx проксирует с 127.0.0.1 — доверяем только ему для корректного X-Forwarded-For
	_ = router.SetTrustedProxies([]string{"127.0.0.1"})

	// Глобальные middleware
	router.Use(middleware.SecurityHeadersMiddleware())
	router.Use(middleware.RecoveryMiddleware(logger))
	router.Use(middleware.LoggingMiddleware(logger))
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.MetricsMiddleware())
	router.Use(middleware.CORSMiddleware(cfg.CORS.Origins))
	router.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 10<<20) // 10MB (покрывает загрузку изображений)
		c.Next()
	})

	// API v1 маршруты
	v1 := router.Group("/api/v1")
	{
		authHandler.RegisterRoutes(v1)
		userHandler.RegisterRoutes(v1)
		catalogHandler.RegisterRoutes(v1)
		catalogHandler.RegisterAdminRoutes(v1, middleware.AuthMiddleware(authService), middleware.RoleRequired("ADMIN"))
		orderHandler.RegisterRoutes(v1)
		adminHandler.RegisterRoutes(v1, middleware.AdminAuthMiddleware(cfg.Admin))
		pickerHandler.RegisterRoutes(v1)
		favoritesHandler.RegisterRoutes(v1)
		pushHandler.RegisterRoutes(v1)
	}

	return router
}
