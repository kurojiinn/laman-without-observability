package payments

import (
	"context"
	"database/sql"
	"fmt"

	"Laman/internal/database"
	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// postgresPaymentRepository реализует PaymentRepository используя PostgreSQL.
type postgresPaymentRepository struct {
	db *database.DB
}

// NewPostgresPaymentRepository создает новый PostgreSQL репозиторий оплат.
func NewPostgresPaymentRepository(db *database.DB) PaymentRepository {
	return &postgresPaymentRepository{db: db}
}

const insertPaymentQuery = `
	INSERT INTO payments (id, order_id, method, status, amount, created_at, updated_at)
	VALUES (:id, :order_id, :method, :status, :amount, :created_at, :updated_at)
`

func (r *postgresPaymentRepository) Create(ctx context.Context, payment *models.Payment) error {
	_, err := r.db.NamedExecContext(ctx, insertPaymentQuery, payment)
	return err
}

// CreateTx создаёт запись оплаты внутри транзакции.
// Вызывается из OrderService.CreateOrder для атомарного создания заказа.
func (r *postgresPaymentRepository) CreateTx(ctx context.Context, tx *sqlx.Tx, payment *models.Payment) error {
	query, args, err := tx.BindNamed(insertPaymentQuery, payment)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, query, args...)
	return err
}

func (r *postgresPaymentRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	query := `SELECT id, order_id, method, status, amount, created_at, updated_at FROM payments WHERE id = $1`
	err := r.db.GetContext(ctx, &payment, query, id)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("оплата не найдена")
	}
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *postgresPaymentRepository) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	query := `SELECT id, order_id, method, status, amount, created_at, updated_at FROM payments WHERE order_id = $1`
	err := r.db.GetContext(ctx, &payment, query, orderID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("оплата не найдена")
	}
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

func (r *postgresPaymentRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.PaymentStatus) error {
	query := `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}
