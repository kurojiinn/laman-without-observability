package auth

import (
	"context"
	"database/sql"
	"fmt"
	"Laman/internal/database"
	"Laman/internal/models"
	"github.com/google/uuid"
)

// postgresAuthRepository реализует AuthRepository используя PostgreSQL.
type postgresAuthRepository struct {
	db *database.DB
}

// NewPostgresAuthRepository создает новый PostgreSQL репозиторий аутентификации.
func NewPostgresAuthRepository(db *database.DB) AuthRepository {
	return &postgresAuthRepository{db: db}
}

func (r *postgresAuthRepository) CreateAuthCode(ctx context.Context, code *models.AuthCode) error {
	query := `
		INSERT INTO auth_codes (id, phone, code, expires_at, used, created_at)
		VALUES (:id, :phone, :code, :expires_at, :used, :created_at)
	`
	_, err := r.db.NamedExecContext(ctx, query, code)
	return err
}

func (r *postgresAuthRepository) GetAuthCodeByPhoneAndCode(ctx context.Context, phone, code string) (*models.AuthCode, error) {
	var authCode models.AuthCode
	query := `
		SELECT id, phone, code, expires_at, used, created_at
		FROM auth_codes
		WHERE phone = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1
	`
	err := r.db.GetContext(ctx, &authCode, query, phone, code)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("код аутентификации не найден или истек")
	}
	if err != nil {
		return nil, err
	}
	return &authCode, nil
}

func (r *postgresAuthRepository) MarkAuthCodeAsUsed(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE auth_codes SET used = TRUE WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
