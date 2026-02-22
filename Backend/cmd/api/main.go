package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"Laman/internal/admin"
	"Laman/internal/auth"
	"Laman/internal/catalog"
	"Laman/internal/config"
	"Laman/internal/database"
	"Laman/internal/delivery"
	"Laman/internal/middleware"
	"Laman/internal/observability"
	"Laman/internal/orders"
	"Laman/internal/payments"
	"Laman/internal/users"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

func main() {
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
	defer logger.Sync()

	// Инициализация трейсинга
	tp, err := observability.InitTracing(cfg)
	if err != nil {
		logger.Warn("Не удалось инициализировать трейсинг", zap.Error(err))
	} else {
		defer func() {
			if err := tp.Shutdown(context.Background()); err != nil {
				logger.Error("Не удалось остановить tracer provider", zap.Error(err))
			}
		}()
	}

	// Инициализация базы данных
	db, err := database.New(&cfg.Database)
	if err != nil {
		logger.Fatal("Не удалось подключиться к базе данных", zap.Error(err))
	}
	defer db.Close()

	// Инициализация Telegram уведомлений (опционально)
	var telegramNotifier *observability.TelegramNotifier
	if cfg.Telegram.BotToken != "" && cfg.Telegram.ChatID != "" {
		notifier, err := observability.NewTelegramNotifier(cfg.Telegram.BotToken, cfg.Telegram.ChatID)
		if err != nil {
			logger.Warn("Telegram уведомления отключены", zap.Error(err))
		} else {
			telegramNotifier = notifier
		}
	}

	// Инициализация репозиториев
	authRepo := auth.NewPostgresAuthRepository(db)
	userRepo := users.NewPostgresUserRepository(db)
	categoryRepo := catalog.NewPostgresCategoryRepository(db)
	subcategoryRepo := catalog.NewPostgresSubcategoryRepository(db)
	productRepo := catalog.NewPostgresProductRepository(db)
	storeRepo := catalog.NewPostgresStoreRepository(db)
	orderRepo := orders.NewPostgresOrderRepository(db)
	orderItemRepo := orders.NewPostgresOrderItemRepository(db)
	paymentRepo := payments.NewPostgresPaymentRepository(db)
	deliveryRepo := delivery.NewPostgresDeliveryRepository(db)

	// Инициализация сервисов
	smsProvider := auth.NewSMSRUProvider(cfg.SMS.RuAPIKey)
	authService := auth.NewAuthService(authRepo, userRepo, cfg.JWT.Secret, smsProvider, logger)
	userService := users.NewUserService(userRepo)
	catalogService := catalog.NewCatalogService(categoryRepo, subcategoryRepo, productRepo, storeRepo)
	orderService := orders.NewOrderService(
		orderRepo,
		orderItemRepo,
		productRepo,
		deliveryRepo,
		paymentRepo,
		5.0,   // 5% сервисный сбор
		200.0, // 200 руб. стоимость доставки
		telegramNotifier,
		logger,
	)

	// Инициализация обработчиков
	authHandler := auth.NewHandler(authService, logger)
	userHandler := users.NewHandler(userService, authService)
	catalogHandler := catalog.NewHandler(catalogService, logger)
	orderHandler := orders.NewHandler(orderService, authService)
	adminRepo := admin.NewPostgresRepository(db)
	adminService := admin.NewService(adminRepo, logger)
	adminHandler := admin.NewHandler(adminService, logger, cfg.Server.PublicURL)

	// Настройка роутера
	router := setupRouter(logger, cfg, authHandler, userHandler, catalogHandler, orderHandler, adminHandler)

	// Настройка эндпоинта метрик
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Настройка health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Создание HTTP сервера
	srv := &http.Server{
		Addr:    fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		Handler: router,
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
	authHandler *auth.Handler,
	userHandler *users.Handler,
	catalogHandler *catalog.Handler,
	orderHandler *orders.Handler,
	adminHandler *admin.Handler,
) *gin.Engine {
	router := gin.New()

	// Глобальные middleware
	router.Use(middleware.RecoveryMiddleware(logger))
	router.Use(middleware.LoggingMiddleware(logger))
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.MetricsMiddleware())
	router.Use(middleware.CORSMiddleware(cfg.CORS.Origins))

	// Статика для загруженных файлов
	router.Static("/uploads", "./uploads")

	// API v1 маршруты
	v1 := router.Group("/api/v1")
	{
		authHandler.RegisterRoutes(v1)
		userHandler.RegisterRoutes(v1)
		catalogHandler.RegisterRoutes(v1)
		orderHandler.RegisterRoutes(v1)
		adminHandler.RegisterRoutes(v1, middleware.AdminAuthMiddleware(cfg.Admin))
	}

	return router
}
