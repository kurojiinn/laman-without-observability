package users

import (
	"context"
	"database/sql"
	"fmt"
	"Laman/internal/database"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// postgresUserRepository реализует UserRepository используя PostgreSQL.
type postgresUserRepository struct {
	db *database.DB
}

// NewPostgresUserRepository создает новый PostgreSQL репозиторий пользователей.
func NewPostgresUserRepository(db *database.DB) UserRepository {
	return &postgresUserRepository{db: db}
}

func (r *postgresUserRepository) Create(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (id, phone, created_at, updated_at)
		VALUES (:id, :phone, :created_at, :updated_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, user)
	return err
}

func (r *postgresUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	var user models.User
	query := `SELECT id, phone, created_at, updated_at FROM users WHERE id = $1`
	err := r.db.GetContext(ctx, &user, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("%w", ErrUserNotFound)
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *postgresUserRepository) GetByPhone(ctx context.Context, phone string) (*models.User, error) {
	var user models.User
	query := `SELECT id, phone, created_at, updated_at FROM users WHERE phone = $1`
	err := r.db.GetContext(ctx, &user, query, phone)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("%w", ErrUserNotFound)
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *postgresUserRepository) CreateProfile(ctx context.Context, profile *models.UserProfile) error {
	query := `
		INSERT INTO user_profiles (user_id, name, email, address, created_at, updated_at)
		VALUES (:user_id, :name, :email, :address, :created_at, :updated_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, profile)
	return err
}

func (r *postgresUserRepository) GetProfile(ctx context.Context, userID uuid.UUID) (*models.UserProfile, error) {
	var profile models.UserProfile
	query := `SELECT user_id, name, email, address, created_at, updated_at FROM user_profiles WHERE user_id = $1`
	err := r.db.GetContext(ctx, &profile, query, userID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("%w", ErrProfileNotFound)
	}
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *postgresUserRepository) UpdateProfile(ctx context.Context, profile *models.UserProfile) error {
	query := `
		UPDATE user_profiles
		SET name = :name, email = :email, address = :address, updated_at = :updated_at
		WHERE user_id = :user_id
	`
	_, err := r.db.NamedExecContext(ctx, query, profile)
	return err
}
