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
	pickerRepo PickerRepository
	userRepo   UserRepository
	jwtSecret  string
	logger     *zap.Logger
}

type UserRepository interface {
	GetByPhone(ctx context.Context, phone string) (*models.User, error)
	GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
}

func NewPickerService(pickerRepo PickerRepository,
	userRepo UserRepository,
	jwtSecret string,
	logger *zap.Logger,
) *Service {
	return &Service{
		pickerRepo: pickerRepo,
		userRepo:   userRepo,
		jwtSecret:  jwtSecret,
		logger:     logger,
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

	token, err := p.generateToken(user.ID)
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

func (p *Service) GetOrder(ctx context.Context, orderID uuid.UUID) (*models.Order, error) {
	order, err := p.pickerRepo.GetOrderByID(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("не удалось получить заказ: %w", err)
	}

	return order, nil
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
	order, err := p.GetOrder(ctx, orderID)
	if err != nil {
		return fmt.Errorf("не удалось получить заказ")
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

func (p *Service) generateToken(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(p.jwtSecret))
}

func (p *Service) GetStoreIDByUserID(ctx context.Context, userID uuid.UUID) (uuid.UUID, error) {
	return p.getStoreID(ctx, userID)
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
