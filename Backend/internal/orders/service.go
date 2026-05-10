package orders

import (
	"Laman/internal/events"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"Laman/internal/models"
	"Laman/internal/observability"
	"Laman/internal/push"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// OrderService обрабатывает бизнес-логику, связанную с созданием заказов,
// расчётом цен и управлением жизненным циклом.
type OrderService struct {
	transactor        Transactor
	orderRepo         OrderRepository
	orderItemRepo     OrderItemRepository
	productRepo       ProductRepository
	deliveryRepo      DeliveryRepository
	paymentRepo       PaymentRepository
	notifier          *observability.TelegramNotifier
	pusher            *push.Service
	logger            *zap.Logger
	serviceFeePercent float64
	deliveryFee       float64
	hub               *events.Hub
}

// ProductRepository определяет интерфейс, необходимый из модуля catalog.
type ProductRepository interface {
	GetByIDs(ctx context.Context, ids []uuid.UUID) ([]models.Product, error)
}

// Transactor позволяет сервису запускать несколько операций репозитория
// в рамках одной БД-транзакции. Реализуется через *database.DB.
type Transactor interface {
	WithTx(ctx context.Context, fn func(*sqlx.Tx) error) error
}

// DeliveryRepository определяет интерфейс для работы с доставками.
type DeliveryRepository interface {
	Create(ctx context.Context, delivery *models.Delivery) error

	// CreateTx создаёт запись о доставке внутри транзакции.
	CreateTx(ctx context.Context, tx *sqlx.Tx, delivery *models.Delivery) error
}

// PaymentRepository определяет интерфейс для работы с платежами.
type PaymentRepository interface {
	Create(ctx context.Context, payment *models.Payment) error

	// CreateTx создаёт запись о платеже внутри транзакции.
	CreateTx(ctx context.Context, tx *sqlx.Tx, payment *models.Payment) error
}

// NewOrderService создаёт новый сервис заказов.
// transactor используется для атомарного создания заказа со всеми зависимостями.
func NewOrderService(
	transactor Transactor,
	orderRepo OrderRepository,
	orderItemRepo OrderItemRepository,
	productRepo ProductRepository,
	deliveryRepo DeliveryRepository,
	paymentRepo PaymentRepository,
	serviceFeePercent float64,
	deliveryFee float64,
	notifier *observability.TelegramNotifier,
	pusher *push.Service,
	logger *zap.Logger,
	hub *events.Hub,
) *OrderService {
	return &OrderService{
		transactor:        transactor,
		orderRepo:         orderRepo,
		orderItemRepo:     orderItemRepo,
		productRepo:       productRepo,
		deliveryRepo:      deliveryRepo,
		paymentRepo:       paymentRepo,
		serviceFeePercent: serviceFeePercent,
		deliveryFee:       deliveryFee,
		notifier:          notifier,
		pusher:            pusher,
		logger:            logger,
		hub:               hub,
	}
}

// CreateOrderRequest представляет запрос на создание заказа.
type CreateOrderRequest struct {
	UserID             *uuid.UUID                `json:"user_id"`
	GuestName          *string                   `json:"guest_name,omitempty"`
	CustomerPhone      *string                   `json:"customer_phone,omitempty"`
	Comment            *string                   `json:"comment,omitempty"`
	Items              []CreateOrderItemRequest   `json:"items" binding:"required"`
	PaymentMethod      models.PaymentMethod       `json:"payment_method" binding:"required"`
	DeliveryAddress    string                     `json:"delivery_address" binding:"required"`
	OutOfStockAction   *models.OutOfStockAction   `json:"out_of_stock_action,omitempty"`
	DeliveryType       string                     `json:"delivery_type"`
	ScheduledAt        *time.Time                 `json:"scheduled_at"`
	DeliverySurcharge  int                        `json:"delivery_surcharge"`
}

// CreateOrderItemRequest представляет товар в запросе на создание заказа.
type CreateOrderItemRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
}

// CreateOrder создает новый заказ с товарами, доставкой и оплатой.
func (s *OrderService) CreateOrder(ctx context.Context, req CreateOrderRequest) (*models.OrderWithItems, error) {

	// Получение товаров
	productIDs := make([]uuid.UUID, len(req.Items))
	for i, item := range req.Items {
		productIDs[i] = item.ProductID
	}

	products, err := s.productRepo.GetByIDs(ctx, productIDs)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары: %w", err)
	}

	// Создание карты товаров
	productMap := make(map[uuid.UUID]models.Product)
	for _, product := range products {
		productMap[product.ID] = product
	}

	// Расчет общей стоимости товаров
	var itemsTotal float64
	var totalWeight float64
	orderItems := make([]models.OrderItem, 0, len(req.Items))
	itemLines := make([]string, 0, len(req.Items))
	var storeID *uuid.UUID

	for _, itemReq := range req.Items {
		product, ok := productMap[itemReq.ProductID]
		if !ok {
			return nil, fmt.Errorf("товар не найден: %s", itemReq.ProductID)
		}

		if product.StoreID == uuid.Nil {
			return nil, fmt.Errorf("у товара не задан магазин")
		}

		if storeID == nil {
			storeID = &product.StoreID
		} else if product.StoreID != *storeID {
			return nil, fmt.Errorf("нельзя создавать заказ из разных магазинов")
		}

		if !product.IsAvailable {
			return nil, fmt.Errorf("товар недоступен: %s", product.Name)
		}

		itemTotal := product.Price * float64(itemReq.Quantity)
		itemsTotal += itemTotal

		if product.Weight != nil {
			totalWeight += *product.Weight * float64(itemReq.Quantity)
		}

		productID := product.ID
		orderItems = append(orderItems, models.OrderItem{
			ID:        uuid.New(),
			ProductID: &productID,
			Name:      product.Name,
			Quantity:  itemReq.Quantity,
			Price:     product.Price,
			CreatedAt: time.Now(),
		})

		itemLines = append(itemLines, fmt.Sprintf("%s ×%d", product.Name, itemReq.Quantity))
	}

	// Расчет сборов
	serviceFee := itemsTotal * s.serviceFeePercent / 100
	finalTotal := itemsTotal + serviceFee + s.deliveryFee + float64(req.DeliverySurcharge)

	// Создание заказа
	now := time.Now()
	if storeID == nil {
		return nil, fmt.Errorf("не удалось определить магазин заказа")
	}
	order := &models.Order{
		ID:                uuid.New(),
		UserID:            req.UserID,
		GuestName:         req.GuestName,
		CustomerPhone:     req.CustomerPhone,
		Comment:           req.Comment,
		Status:            models.OrderStatusNew,
		StoreID:           *storeID,
		PaymentMethod:     req.PaymentMethod,
		ItemsTotal:        itemsTotal,
		ServiceFee:        serviceFee,
		DeliveryFee:       s.deliveryFee,
		FinalTotal:        finalTotal,
		CreatedAt:         now,
		UpdatedAt:         now,
		OutOfStockAction:  req.OutOfStockAction,
		DeliveryType:      req.DeliveryType,
		ScheduledAt:       req.ScheduledAt,
		DeliverySurcharge: req.DeliverySurcharge,
	}

	// Устанавливаем OrderID для товаров до транзакции — он уже известен (uuid.New выше).
	for i := range orderItems {
		orderItems[i].OrderID = order.ID
	}

	delivery := &models.Delivery{
		ID:        uuid.New(),
		OrderID:   order.ID,
		Address:   req.DeliveryAddress,
		Weight:    &totalWeight,
		CreatedAt: now,
		UpdatedAt: now,
	}

	payment := &models.Payment{
		ID:        uuid.New(),
		OrderID:   order.ID,
		Method:    req.PaymentMethod,
		Status:    models.PaymentStatusPending,
		Amount:    finalTotal,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Атомарно создаём заказ, позиции, доставку и платёж в одной транзакции.
	// Если любой из шагов упадёт — вся транзакция откатится, "полузаказов" не будет.
	if err = s.transactor.WithTx(ctx, func(tx *sqlx.Tx) error {
		if err := s.orderRepo.CreateTx(ctx, tx, order); err != nil {
			return fmt.Errorf("заказ: %w", err)
		}
		if err := s.orderItemRepo.CreateBatchTx(ctx, tx, orderItems); err != nil {
			return fmt.Errorf("позиции заказа: %w", err)
		}
		if err := s.deliveryRepo.CreateTx(ctx, tx, delivery); err != nil {
			return fmt.Errorf("доставка: %w", err)
		}
		if err := s.paymentRepo.CreateTx(ctx, tx, payment); err != nil {
			return fmt.Errorf("платёж: %w", err)
		}
		return nil
	}); err != nil {
		return nil, fmt.Errorf("не удалось создать заказ: %w", err)
	}

	if payload, err := json.Marshal(map[string]string{
		"type":     "new_order",
		"order_id": order.ID.String(),
		"message":  "Новый заказ",
	}); err == nil {
		s.hub.Notify(order.StoreID, string(payload))
	}

	// Push-уведомление всем сборщикам магазина о новом заказе.
	if s.pusher != nil {
		n := push.NotificationForNewOrderPicker(order.ID.String(), finalTotal, len(orderItems))
		s.pusher.SendToStorePickers(ctx, order.StoreID, n)
	}

	if s.notifier != nil {
		itemsText := strings.Join(itemLines, ", ")
		phone := ""
		if req.CustomerPhone != nil {
			phone = *req.CustomerPhone
		}
		comment := ""
		if req.Comment != nil {
			comment = *req.Comment
		}

		customer := "Гость"
		if req.GuestName != nil && *req.GuestName != "" {
			customer = *req.GuestName
		} else if req.UserID != nil {
			customer = fmt.Sprintf("Пользователь %s", shortUUID(*req.UserID))
		}

		notifyCtx := observability.WithOrderMessageMeta(context.Background(), observability.OrderMessageMeta{
			Customer: customer,
			Phone:    phone,
			Comment:  comment,
			Address:  req.DeliveryAddress,
			Items:    itemsText,
		})

		notifier := s.notifier
		orderCopy := *order
		logger := s.logger
		go func() {
			if err := notifier.NotifyNewOrder(notifyCtx, &orderCopy); err != nil && logger != nil {
				logger.Warn("Не удалось отправить уведомление в Telegram", zap.Error(err))
			}
		}()
	}

	return &models.OrderWithItems{
		Order: *order,
		Items: orderItems,
	}, nil
}

func shortUUID(id uuid.UUID) string {
	value := id.String()
	if len(value) <= 8 {
		return value
	}
	return value[:8]
}


func (s *OrderService) buildItemsText(ctx context.Context, orderID uuid.UUID) string {
	items, err := s.orderItemRepo.GetByOrderID(ctx, orderID)
	if err != nil || len(items) == 0 {
		return ""
	}

	lines := make([]string, 0, len(items))
	for _, item := range items {
		name := item.Name
		if name == "" && item.ProductID != nil {
			name = item.ProductID.String()[:8]
		}
		lines = append(lines, fmt.Sprintf("%s ×%d", name, item.Quantity))
	}

	return strings.Join(lines, ", ")
}

// GetOrder получает заказ по ID с товарами.
func (s *OrderService) GetOrder(ctx context.Context, id uuid.UUID) (*models.OrderWithItems, error) {
	order, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить заказ: %w", err)
	}

	items, err := s.orderItemRepo.GetByOrderID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары заказа: %w", err)
	}

	return &models.OrderWithItems{
		Order: *order,
		Items: items,
	}, nil
}

// GetUserOrders получает заказы пользователя с пагинацией.
// Возвращает (data, total, err). page == nil — без пагинации.
func (s *OrderService) GetUserOrders(ctx context.Context, userID uuid.UUID, page *models.Page) ([]models.Order, int, error) {
	orders, total, err := s.orderRepo.GetByUserID(ctx, userID, page)
	if err != nil {
		return nil, 0, fmt.Errorf("не удалось получить заказы пользователя: %w", err)
	}
	return orders, total, nil
}

// CancelOrderByUser отменяет заказ от имени клиента.
// Проверяет что заказ принадлежит пользователю и что отмена допустима.
func (s *OrderService) CancelOrderByUser(ctx context.Context, orderID uuid.UUID, userID uuid.UUID) error {
	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		return fmt.Errorf("не удалось получить заказ: %w", err)
	}

	if order.UserID == nil || *order.UserID != userID {
		return fmt.Errorf("доступ запрещён")
	}

	// Клиент может отменить заказ только до того, как сборщик собрал его.
	// После статуса ASSEMBLED отмена доступна только пикеру/админу.
	switch order.Status {
	case models.OrderStatusNew,
		models.OrderStatusAcceptedByPicker,
		models.OrderStatusNeedsConfirmation,
		models.OrderStatusAssembling:
		// разрешено
	default:
		return fmt.Errorf("заказ уже собран — отмена недоступна")
	}

	if !models.IsValidStateTransition(order.Status, models.OrderStatusCancelled) {
		return fmt.Errorf("заказ нельзя отменить на текущем этапе")
	}

	if err := s.orderRepo.UpdateStatus(ctx, orderID, models.OrderStatusCancelled); err != nil {
		return fmt.Errorf("не удалось отменить заказ: %w", err)
	}

	// Уведомляем сборщика магазина об отмене через SSE
	cancelPhone := ""
	if order.CustomerPhone != nil {
		cancelPhone = *order.CustomerPhone
	}
	if payload, err := json.Marshal(map[string]string{
		"type":            "order_cancelled",
		"order_id":        orderID.String(),
		"customer_phone":  cancelPhone,
		"message":         "Клиент отменил заказ",
	}); err == nil {
		s.hub.Notify(order.StoreID, string(payload))
	}

	if s.notifier != nil {
		itemsText := s.buildItemsText(ctx, order.ID)
		phone := ""
		if order.CustomerPhone != nil {
			phone = *order.CustomerPhone
		}
		comment := ""
		if order.Comment != nil {
			comment = *order.Comment
		}
		notifyCtx := observability.WithOrderMessageMeta(ctx, observability.OrderMessageMeta{
			Customer: fmt.Sprintf("Пользователь %s", shortUUID(userID)),
			Phone:    phone,
			Comment:  comment,
			Items:    itemsText,
		})
		if err := s.notifier.NotifyOrderCancelled(notifyCtx, order); err != nil && s.logger != nil {
			s.logger.Warn("Не удалось отправить отмену в Telegram", zap.Error(err))
		}
	}

	return nil
}

// UpdateOrderStatusRequest представляет запрос на обновление статуса заказа.
type UpdateOrderStatusRequest struct {
	Status models.OrderStatus `json:"status" binding:"required"`
}

// UpdateOrderStatus обновляет статус заказа с валидацией.
func (s *OrderService) UpdateOrderStatus(ctx context.Context, id uuid.UUID, newStatus models.OrderStatus) error {
	// Получение текущего заказа
	order, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("не удалось получить заказ: %w", err)
	}

	// Валидация перехода состояния
	if !models.IsValidStateTransition(order.Status, newStatus) {
		return fmt.Errorf("недопустимый переход состояния из %s в %s", order.Status, newStatus)
	}

	// Обновление статуса
	if err := s.orderRepo.UpdateStatus(ctx, id, newStatus); err != nil {
		return fmt.Errorf("не удалось обновить статус заказа: %w", err)
	}

	// Push-уведомления для авторизованного клиента.
	// URL содержит ?order=<id> — фронт прочитает и откроет модалку этого заказа.
	if s.pusher != nil && order.UserID != nil {
		if n, ok := push.NotificationForOrderStatus(id.String(), string(newStatus)); ok {
			s.pusher.SendToUser(ctx, *order.UserID, n)
		}
	}

	if newStatus == models.OrderStatusCancelled && s.notifier != nil {
		itemsText := s.buildItemsText(ctx, order.ID)
		customer := fmt.Sprintf("Пользователь %s", shortUUID(order.ID))
		if order.UserID != nil {
			customer = fmt.Sprintf("Пользователь %s", shortUUID(*order.UserID))
		}
		phone := ""
		if order.CustomerPhone != nil {
			phone = *order.CustomerPhone
		}
		comment := ""
		if order.Comment != nil {
			comment = *order.Comment
		}
		notifyCtx := observability.WithOrderMessageMeta(ctx, observability.OrderMessageMeta{
			Customer: customer,
			Phone:    phone,
			Comment:  comment,
			Address:  "",
			Items:    itemsText,
		})

		if err := s.notifier.NotifyOrderCancelled(notifyCtx, order); err != nil && s.logger != nil {
			s.logger.Warn("Не удалось отправить отмену в Telegram", zap.Error(err))
		}
	}

	return nil
}

