package picker

import (
	"Laman/internal/models"
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	pickerRepo        PickerRepository
	userRepo          UserRepository
	jwtSecret         string
	serviceFeePercent float64
	logger            *zap.Logger
}

type UserRepository interface {
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
}

func NewPickerService(pickerRepo PickerRepository,
	userRepo UserRepository,
	jwtSecret string,
	serviceFeePercent float64,
	logger *zap.Logger,
) *Service {
	return &Service{
		pickerRepo:        pickerRepo,
		userRepo:          userRepo,
		jwtSecret:         jwtSecret,
		serviceFeePercent: serviceFeePercent,
		logger:            logger,
	}
}
func (p *Service) Login(ctx context.Context, login LoginRequest) (LoginResponse, error) {
	user, err := p.userRepo.GetByPhone(ctx, login.Phone)
	if err != nil {
		return LoginResponse{}, err
	}

	if user.Role != "PICKER" {
		return LoginResponse{}, fmt.Errorf("доступ запрещен")
	}

	if user.PasswordHash == nil {
		return LoginResponse{}, fmt.Errorf("нет пароля")
	}

	// сравнить пароль с хэшем
	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(login.Password))
	if err != nil {
		return LoginResponse{}, fmt.Errorf("доступ запрещен, неверный пароль")
	}

	token, err := p.generateToken(user.ID, user.Role)
	if err != nil {
		return LoginResponse{}, err
	}

	return LoginResponse{
		Token:   token,
		UserID:  user.ID,
		StoreID: user.StoreID,
		Role:    user.Role,
	}, nil
}

func (p *Service) GetOrder(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID) (*PickerOrderResponse, error) {
	order, err := p.pickerRepo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить заказ: %w", err)
	}

	// Проверяем, что заказ принадлежит магазину сборщика.
	pickerStoreID, err := p.getStoreID(ctx, pickerID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить магазин сборщика: %w", err)
	}
	if order.StoreID != pickerStoreID {
		return nil, fmt.Errorf("заказ не принадлежит вашему магазину")
	}

	items, err := p.pickerRepo.GetOrderItemsByOrderID(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить товары заказа: %w", err)
	}

	return &PickerOrderResponse{
		Order: *order,
		Items: items,
	}, nil
}

func (p *Service) GetOrdersByUserID(ctx context.Context, userID uuid.UUID) ([]models.Order, error) {
	storeID, err := p.getStoreID(ctx, userID)
	if err != nil {
		return nil, err
	}

	orders, err := p.pickerRepo.GetOrders(ctx, storeID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить заказы пользователя: %w", err)
	}

	return orders, nil
}

func (p *Service) UpdateStatus(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID, newStatus models.OrderStatus) error {
	orderResp, err := p.GetOrder(ctx, orderID, pickerID)
	if err != nil {
		return fmt.Errorf("не удалось получить заказ: %w", err)
	}
	order := &orderResp.Order

	if isOrderFinalized(order.Status) {
		return fmt.Errorf("нельзя изменить заказ со статусом %s", order.Status)
	}
	if order.PickerID != nil && *order.PickerID != pickerID {
		return fmt.Errorf("заказ уже взят другим сборщиком")
	}

	// Валидация перехода состояния
	if !models.IsValidStateTransition(order.Status, newStatus) {
		return fmt.Errorf("недопустимый переход состояния из %s в %s", order.Status, newStatus)
	}

	// На этапе "взят/в сборке" назначаем сборщика атомарно вместе со статусом.
	if newStatus == models.OrderStatusAcceptedByPicker || newStatus == models.OrderStatusAssembling {
		err = p.pickerRepo.UpdateStatusAndAssignPicker(ctx, orderID, newStatus, pickerID)
	} else {
		err = p.pickerRepo.UpdateStatus(ctx, orderID, newStatus)
	}
	if err != nil {
		return fmt.Errorf("не удалось обновить статус заказа: %w", err)
	}

	return nil
}

func (p *Service) AddItem(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID, req AddItemRequest) (*PickerOrderItem, error) {
	orderResp, err := p.GetOrder(ctx, orderID, pickerID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить заказ: %w", err)
	}
	if isOrderFinalized(orderResp.Order.Status) {
		return nil, fmt.Errorf("нельзя изменить заказ со статусом %s", orderResp.Order.Status)
	}

	item, err := p.pickerRepo.AddOrderItem(ctx, orderID, req.ProductName, req.Price, req.Quantity)
	if err != nil {
		return nil, fmt.Errorf("не удалось добавить товар: %w", err)
	}

	if err := p.pickerRepo.RecalcOrderTotals(ctx, orderID, p.serviceFeePercent); err != nil {
		return nil, fmt.Errorf("не удалось пересчитать сумму: %w", err)
	}

	return item, nil
}

func (p *Service) RemoveItem(ctx context.Context, orderID uuid.UUID, itemID uuid.UUID, pickerID uuid.UUID) error {
	orderResp, err := p.GetOrder(ctx, orderID, pickerID)
	if err != nil {
		return fmt.Errorf("не удалось получить заказ: %w", err)
	}
	if isOrderFinalized(orderResp.Order.Status) {
		return fmt.Errorf("нельзя изменить заказ со статусом %s", orderResp.Order.Status)
	}

	if err := p.pickerRepo.RemoveOrderItem(ctx, itemID); err != nil {
		return fmt.Errorf("не удалось удалить товар: %w", err)
	}

	if err := p.pickerRepo.RecalcOrderTotals(ctx, orderID, p.serviceFeePercent); err != nil {
		return fmt.Errorf("не удалось пересчитать сумму: %w", err)
	}

	return nil
}

func (p *Service) generateToken(userID uuid.UUID, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"role":    role,
		"jti":     uuid.New().String(),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(p.jwtSecret))
}

func (p *Service) GetStoreIDByUserID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	return p.getStoreID(ctx, userID)
}

// AnalyticsPeriod — окно аналитики, выбираемое сборщиком в UI.
type AnalyticsPeriod string

const (
	AnalyticsPeriodDay   AnalyticsPeriod = "day"
	AnalyticsPeriodWeek  AnalyticsPeriod = "week"
	AnalyticsPeriodMonth AnalyticsPeriod = "month"
)

// periodStart возвращает начало текущих суток/недели/месяца в локальной зоне сервера.
// Совпадает по семантике с Postgres date_trunc — т. е. "сегодня с 00:00".
func periodStart(period AnalyticsPeriod, now time.Time) time.Time {
	y, m, d := now.Date()
	loc := now.Location()
	switch period {
	case AnalyticsPeriodWeek:
		// ISO-неделя начинается с понедельника. Воскресенье = 7.
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		monday := time.Date(y, m, d, 0, 0, 0, 0, loc).AddDate(0, 0, -(weekday - 1))
		return monday
	case AnalyticsPeriodMonth:
		return time.Date(y, m, 1, 0, 0, 0, 0, loc)
	default: // day и любой неизвестный — трактуем как "сегодня"
		return time.Date(y, m, d, 0, 0, 0, 0, loc)
	}
}

// GetTopProducts возвращает топ продаваемых товаров магазина сборщика за период.
func (p *Service) GetTopProducts(ctx context.Context, pickerID uuid.UUID, period AnalyticsPeriod) ([]TopProduct, error) {
	storeID, err := p.getStoreID(ctx, pickerID)
	if err != nil {
		return nil, err
	}
	since := periodStart(period, time.Now())
	return p.pickerRepo.GetTopProducts(ctx, storeID, since, 10)
}

func (p *Service) getStoreID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	user, err := p.userRepo.GetByID(ctx, userID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("пользователь не найден")
	}
	if user.StoreID == nil {
		return uuid.Nil, fmt.Errorf("сборщик не привязан к магазину")
	}
	return *user.StoreID, nil
}

// isOrderFinalized возвращает true для финальных статусов (изменение запрещено).
func isOrderFinalized(status models.OrderStatus) bool {
	return status == models.OrderStatusCancelled || status == models.OrderStatusDelivered
}
