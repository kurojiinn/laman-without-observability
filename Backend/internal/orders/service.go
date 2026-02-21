package orders

import (
	"context"
	"fmt"
	"strings"
	"time"

	"Laman/internal/models"
	"Laman/internal/observability"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// OrderService обрабатывает бизнес-логику, связанную с созданием заказов,
// расчетом цен и управлением жизненным циклом.
type OrderService struct {
	orderRepo         OrderRepository
	orderItemRepo     OrderItemRepository
	productRepo       ProductRepository
	deliveryRepo      DeliveryRepository
	paymentRepo       PaymentRepository
	notifier          *observability.TelegramNotifier
	logger            *zap.Logger
	serviceFeePercent float64
	deliveryFee       float64
}

// ProductRepository определяет интерфейс, необходимый из модуля catalog.
type ProductRepository interface {
	GetByIDs(ctx context.Context, ids []uuid.UUID) ([]models.Product, error)
}

// DeliveryRepository определяет интерфейс, необходимый из модуля delivery.
type DeliveryRepository interface {
	Create(ctx context.Context, delivery *models.Delivery) error
}

// PaymentRepository определяет интерфейс, необходимый из модуля payments.
type PaymentRepository interface {
	Create(ctx context.Context, payment *models.Payment) error
}

// NewOrderService создает новый сервис заказов.
func NewOrderService(
	orderRepo OrderRepository,
	orderItemRepo OrderItemRepository,
	productRepo ProductRepository,
	deliveryRepo DeliveryRepository,
	paymentRepo PaymentRepository,
	serviceFeePercent float64,
	deliveryFee float64,
	notifier *observability.TelegramNotifier,
	logger *zap.Logger,
) *OrderService {
	return &OrderService{
		orderRepo:         orderRepo,
		orderItemRepo:     orderItemRepo,
		productRepo:       productRepo,
		deliveryRepo:      deliveryRepo,
		paymentRepo:       paymentRepo,
		serviceFeePercent: serviceFeePercent,
		deliveryFee:       deliveryFee,
		notifier:          notifier,
		logger:            logger,
	}
}

// CreateOrderRequest представляет запрос на создание заказа.
type CreateOrderRequest struct {
	UserID          *uuid.UUID               `json:"user_id,omitempty"`
	GuestName       *string                  `json:"guest_name,omitempty"`
	GuestPhone      *string                  `json:"guest_phone,omitempty"`
	GuestAddress    *string                  `json:"guest_address,omitempty"`
	Comment         *string                  `json:"comment,omitempty"`
	Items           []CreateOrderItemRequest `json:"items" binding:"required"`
	PaymentMethod   models.PaymentMethod     `json:"payment_method" binding:"required"`
	DeliveryAddress string                   `json:"delivery_address" binding:"required"`
}

// CreateOrderItemRequest представляет товар в запросе на создание заказа.
type CreateOrderItemRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
}

// CreateOrder создает новый заказ с товарами, доставкой и оплатой.
func (s *OrderService) CreateOrder(ctx context.Context, req CreateOrderRequest) (*models.OrderWithItems, error) {
	// Валидация запроса
	if req.UserID == nil && (req.GuestName == nil || req.GuestPhone == nil || req.GuestAddress == nil) {
		return nil, fmt.Errorf("должен быть указан либо user_id, либо информация о госте")
	}

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

		orderItems = append(orderItems, models.OrderItem{
			ID:        uuid.New(),
			ProductID: product.ID,
			Quantity:  itemReq.Quantity,
			Price:     product.Price,
			CreatedAt: time.Now(),
		})

		itemLines = append(itemLines, fmt.Sprintf("%s ×%d", product.Name, itemReq.Quantity))
	}

	// Расчет сборов
	serviceFee := itemsTotal * s.serviceFeePercent / 100
	finalTotal := itemsTotal + serviceFee + s.deliveryFee

	// Создание заказа
	now := time.Now()
	if storeID == nil {
		return nil, fmt.Errorf("не удалось определить магазин заказа")
	}
	order := &models.Order{
		ID:            uuid.New(),
		UserID:        req.UserID,
		GuestName:     req.GuestName,
		GuestPhone:    req.GuestPhone,
		GuestAddress:  req.GuestAddress,
		Comment:       req.Comment,
		Status:        models.OrderStatusNew,
		StoreID:       *storeID,
		PaymentMethod: req.PaymentMethod,
		ItemsTotal:    itemsTotal,
		ServiceFee:    serviceFee,
		DeliveryFee:   s.deliveryFee,
		FinalTotal:    finalTotal,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Создание заказа в транзакции
	err = s.orderRepo.Create(ctx, order)
	if err != nil {
		return nil, fmt.Errorf("не удалось создать заказ: %w", err)
	}

	// Установка ID заказа для товаров
	for i := range orderItems {
		orderItems[i].OrderID = order.ID
	}

	// Создание товаров заказа
	if err := s.orderItemRepo.CreateBatch(ctx, orderItems); err != nil {
		return nil, fmt.Errorf("не удалось создать товары заказа: %w", err)
	}

	// Создание доставки
	delivery := &models.Delivery{
		ID:        uuid.New(),
		OrderID:   order.ID,
		Address:   req.DeliveryAddress,
		Weight:    &totalWeight,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.deliveryRepo.Create(ctx, delivery); err != nil {
		return nil, fmt.Errorf("не удалось создать доставку: %w", err)
	}

	// Создание оплаты
	payment := &models.Payment{
		ID:        uuid.New(),
		OrderID:   order.ID,
		Method:    req.PaymentMethod,
		Status:    models.PaymentStatusPending,
		Amount:    finalTotal,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		return nil, fmt.Errorf("не удалось создать оплату: %w", err)
	}

	if s.notifier != nil {
		itemsText := strings.Join(itemLines, ", ")
		customerText := buildCustomerText(req, order.ID)
		addressText := buildAddressText(req)

		notifyCtx := observability.WithOrderMessageMeta(ctx, observability.OrderMessageMeta{
			Customer: customerText,
			Phone:    buildPhoneText(req),
			Comment:  buildCommentText(req),
			Address:  addressText,
			Items:    itemsText,
		})

		if err := s.notifier.NotifyNewOrder(notifyCtx, order); err != nil && s.logger != nil {
			s.logger.Warn("Не удалось отправить уведомление в Telegram", zap.Error(err))
		}
	}

	return &models.OrderWithItems{
		Order: *order,
		Items: orderItems,
	}, nil
}

func buildCustomerText(req CreateOrderRequest, orderID uuid.UUID) string {
	if req.GuestName != nil && *req.GuestName != "" {
		return *req.GuestName
	}

	if req.UserID != nil {
		return fmt.Sprintf("Пользователь %s", shortUUID(*req.UserID))
	}

	return fmt.Sprintf("Гость %s", shortUUID(orderID))
}

func buildPhoneText(req CreateOrderRequest) string {
	if req.GuestPhone != nil && *req.GuestPhone != "" {
		return *req.GuestPhone
	}
	return ""
}

func buildCommentText(req CreateOrderRequest) string {
	if req.Comment != nil && *req.Comment != "" {
		return *req.Comment
	}
	return ""
}

func buildAddressText(req CreateOrderRequest) string {
	if req.DeliveryAddress != "" {
		return req.DeliveryAddress
	}
	if req.GuestAddress != nil && *req.GuestAddress != "" {
		return *req.GuestAddress
	}
	return ""
}

func shortUUID(id uuid.UUID) string {
	value := id.String()
	if len(value) <= 8 {
		return value
	}
	return value[:8]
}

func buildCustomerTextFromOrder(order *models.Order) string {
	if order.GuestName != nil && *order.GuestName != "" {
		return *order.GuestName
	}
	if order.UserID != nil {
		return fmt.Sprintf("Пользователь %s", shortUUID(*order.UserID))
	}
	return fmt.Sprintf("Гость %s", shortUUID(order.ID))
}

func buildPhoneTextFromOrder(order *models.Order) string {
	if order.GuestPhone != nil && *order.GuestPhone != "" {
		return *order.GuestPhone
	}
	return ""
}

func buildCommentTextFromOrder(order *models.Order) string {
	if order.Comment != nil && *order.Comment != "" {
		return *order.Comment
	}
	return ""
}

func buildAddressTextFromOrder(order *models.Order) string {
	if order.GuestAddress != nil && *order.GuestAddress != "" {
		return *order.GuestAddress
	}
	return ""
}

func (s *OrderService) buildItemsText(ctx context.Context, orderID uuid.UUID) string {
	items, err := s.orderItemRepo.GetByOrderID(ctx, orderID)
	if err != nil || len(items) == 0 {
		return ""
	}

	ids := make([]uuid.UUID, 0, len(items))
	seen := make(map[uuid.UUID]struct{})
	for _, item := range items {
		if _, ok := seen[item.ProductID]; ok {
			continue
		}
		seen[item.ProductID] = struct{}{}
		ids = append(ids, item.ProductID)
	}

	products, err := s.productRepo.GetByIDs(ctx, ids)
	if err != nil {
		return ""
	}

	nameByID := make(map[uuid.UUID]string, len(products))
	for _, p := range products {
		nameByID[p.ID] = p.Name
	}

	lines := make([]string, 0, len(items))
	for _, item := range items {
		name := nameByID[item.ProductID]
		if name == "" {
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

// GetUserOrders получает все заказы пользователя.
func (s *OrderService) GetUserOrders(ctx context.Context, userID uuid.UUID) ([]models.Order, error) {
	orders, err := s.orderRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить заказы пользователя: %w", err)
	}
	return orders, nil
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
	if !isValidStateTransition(order.Status, newStatus) {
		return fmt.Errorf("недопустимый переход состояния из %s в %s", order.Status, newStatus)
	}

	// Обновление статуса
	if err := s.orderRepo.UpdateStatus(ctx, id, newStatus); err != nil {
		return fmt.Errorf("не удалось обновить статус заказа: %w", err)
	}

	if newStatus == models.OrderStatusCancelled && s.notifier != nil {
		itemsText := s.buildItemsText(ctx, order.ID)
		notifyCtx := observability.WithOrderMessageMeta(ctx, observability.OrderMessageMeta{
			Customer: buildCustomerTextFromOrder(order),
			Phone:    buildPhoneTextFromOrder(order),
			Comment:  buildCommentTextFromOrder(order),
			Address:  buildAddressTextFromOrder(order),
			Items:    itemsText,
		})

		if err := s.notifier.NotifyOrderCancelled(notifyCtx, order); err != nil && s.logger != nil {
			s.logger.Warn("Не удалось отправить отмену в Telegram", zap.Error(err))
		}
	}

	return nil
}

// isValidStateTransition валидирует, разрешен ли переход состояния.
func isValidStateTransition(current, next models.OrderStatus) bool {
	validTransitions := map[models.OrderStatus][]models.OrderStatus{
		models.OrderStatusNew: {
			models.OrderStatusNeedsConfirmation,
			models.OrderStatusCancelled,
		},
		models.OrderStatusNeedsConfirmation: {
			models.OrderStatusConfirmed,
			models.OrderStatusCancelled,
		},
		models.OrderStatusConfirmed: {
			models.OrderStatusInProgress,
			models.OrderStatusCancelled,
		},
		models.OrderStatusInProgress: {
			models.OrderStatusDelivered,
			models.OrderStatusCancelled,
		},
		models.OrderStatusDelivered: {}, // Финальное состояние
		models.OrderStatusCancelled: {}, // Финальное состояние
	}

	allowed, ok := validTransitions[current]
	if !ok {
		return false
	}

	for _, status := range allowed {
		if status == next {
			return true
		}
	}

	return false
}
