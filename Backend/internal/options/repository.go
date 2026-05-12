// Package options содержит работу с опциями товара (product_option_groups,
// product_option_values, order_item_options). Используется admin (CRUD),
// catalog (отдача в карточке товара) и orders (создание snapshot при заказе).
package options

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"Laman/internal/database"
	"Laman/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository управляет данными опций.
type Repository interface {
	GetGroupsByProduct(ctx context.Context, productID uuid.UUID) ([]models.ProductOptionGroup, error)
	GetGroupsByProductIDs(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID][]models.ProductOptionGroup, error)
	CreateGroup(ctx context.Context, g *models.ProductOptionGroup) error
	UpdateGroup(ctx context.Context, id uuid.UUID, name, kind string, isRequired bool, position int) error
	DeleteGroup(ctx context.Context, id uuid.UUID) error
	CreateValue(ctx context.Context, v *models.ProductOptionValue) error
	UpdateValue(ctx context.Context, id uuid.UUID, name string, priceDelta *float64, isDefault bool, position int) error
	DeleteValue(ctx context.Context, id uuid.UUID) error
	// GetValuesByIDs нужен для валидации выбора клиента и snapshot'а при создании заказа.
	GetValuesByIDs(ctx context.Context, ids []uuid.UUID) ([]ValueWithGroup, error)
	// CreateOrderItemOption сохраняет snapshot опции в транзакции создания заказа.
	CreateOrderItemOptionTx(ctx context.Context, tx *sqlx.Tx, opt *models.OrderItemOption) error
	// GetOptionsForOrderItems — батч-загрузка опций по списку order_item_id (для админа/пикера).
	GetOptionsForOrderItems(ctx context.Context, orderItemIDs []uuid.UUID) (map[uuid.UUID][]models.OrderItemOption, error)
}

// ValueWithGroup пакует значение опции вместе с метаданными группы — упрощает snapshot.
type ValueWithGroup struct {
	ValueID    uuid.UUID `db:"value_id"`
	ValueName  string    `db:"value_name"`
	PriceDelta *float64  `db:"price_delta"`
	GroupID    uuid.UUID `db:"group_id"`
	GroupName  string    `db:"group_name"`
	ProductID  uuid.UUID `db:"product_id"`
	Kind       string    `db:"kind"`
}

type postgresRepository struct {
	db *database.DB
}

// NewPostgresRepository создаёт репозиторий опций.
func NewPostgresRepository(db *database.DB) Repository {
	return &postgresRepository{db: db}
}

func (r *postgresRepository) GetGroupsByProduct(ctx context.Context, productID uuid.UUID) ([]models.ProductOptionGroup, error) {
	groups, err := r.fetchGroups(ctx, []uuid.UUID{productID})
	if err != nil {
		return nil, err
	}
	return groups[productID], nil
}

func (r *postgresRepository) GetGroupsByProductIDs(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID][]models.ProductOptionGroup, error) {
	if len(productIDs) == 0 {
		return map[uuid.UUID][]models.ProductOptionGroup{}, nil
	}
	return r.fetchGroups(ctx, productIDs)
}

func (r *postgresRepository) fetchGroups(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID][]models.ProductOptionGroup, error) {
	query, args, err := sqlx.In(`
		SELECT id, product_id, name, kind, is_required, position, created_at, updated_at
		FROM product_option_groups
		WHERE product_id IN (?)
		ORDER BY product_id, position, name
	`, productIDs)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)

	var groups []models.ProductOptionGroup
	if err := r.db.SelectContext(ctx, &groups, query, args...); err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return map[uuid.UUID][]models.ProductOptionGroup{}, nil
	}

	groupIDs := make([]uuid.UUID, len(groups))
	for i, g := range groups {
		groupIDs[i] = g.ID
	}

	valueQuery, valueArgs, err := sqlx.In(`
		SELECT id, group_id, name, price_delta, is_default, position, created_at, updated_at
		FROM product_option_values
		WHERE group_id IN (?)
		ORDER BY group_id, position, name
	`, groupIDs)
	if err != nil {
		return nil, err
	}
	valueQuery = r.db.Rebind(valueQuery)

	var values []models.ProductOptionValue
	if err := r.db.SelectContext(ctx, &values, valueQuery, valueArgs...); err != nil {
		return nil, err
	}

	byGroup := make(map[uuid.UUID][]models.ProductOptionValue, len(groups))
	for _, v := range values {
		byGroup[v.GroupID] = append(byGroup[v.GroupID], v)
	}

	result := make(map[uuid.UUID][]models.ProductOptionGroup)
	for _, g := range groups {
		g.Values = byGroup[g.ID]
		result[g.ProductID] = append(result[g.ProductID], g)
	}
	return result, nil
}

func (r *postgresRepository) CreateGroup(ctx context.Context, g *models.ProductOptionGroup) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	if g.Kind == "" {
		g.Kind = "variant"
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO product_option_groups (id, product_id, name, kind, is_required, position, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
		g.ID, g.ProductID, strings.TrimSpace(g.Name), g.Kind, g.IsRequired, g.Position,
	)
	return err
}

func (r *postgresRepository) UpdateGroup(ctx context.Context, id uuid.UUID, name, kind string, isRequired bool, position int) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE product_option_groups SET name=$1, kind=$2, is_required=$3, position=$4, updated_at=NOW() WHERE id=$5`,
		strings.TrimSpace(name), kind, isRequired, position, id,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("группа опций не найдена")
	}
	return nil
}

func (r *postgresRepository) DeleteGroup(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM product_option_groups WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("группа опций не найдена")
	}
	return nil
}

func (r *postgresRepository) CreateValue(ctx context.Context, v *models.ProductOptionValue) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO product_option_values (id, group_id, name, price_delta, is_default, position, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
		v.ID, v.GroupID, strings.TrimSpace(v.Name), v.PriceDelta, v.IsDefault, v.Position,
	)
	return err
}

func (r *postgresRepository) UpdateValue(ctx context.Context, id uuid.UUID, name string, priceDelta *float64, isDefault bool, position int) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE product_option_values SET name=$1, price_delta=$2, is_default=$3, position=$4, updated_at=NOW() WHERE id=$5`,
		strings.TrimSpace(name), priceDelta, isDefault, position, id,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("значение опции не найдено")
	}
	return nil
}

func (r *postgresRepository) DeleteValue(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM product_option_values WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return fmt.Errorf("значение опции не найдено")
	}
	return nil
}

func (r *postgresRepository) GetValuesByIDs(ctx context.Context, ids []uuid.UUID) ([]ValueWithGroup, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	query, args, err := sqlx.In(`
		SELECT v.id AS value_id, v.name AS value_name, v.price_delta,
		       g.id AS group_id, g.name AS group_name, g.product_id, g.kind
		FROM product_option_values v
		JOIN product_option_groups g ON g.id = v.group_id
		WHERE v.id IN (?)
	`, ids)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	var rows []ValueWithGroup
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return rows, nil
}

func (r *postgresRepository) CreateOrderItemOptionTx(ctx context.Context, tx *sqlx.Tx, opt *models.OrderItemOption) error {
	if opt.ID == uuid.Nil {
		opt.ID = uuid.New()
	}
	_, err := tx.ExecContext(ctx,
		`INSERT INTO order_item_options (id, order_item_id, group_id, value_id, group_name, value_name, price_delta, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
		opt.ID, opt.OrderItemID, opt.GroupID, opt.ValueID, opt.GroupName, opt.ValueName, opt.PriceDelta,
	)
	return err
}

func (r *postgresRepository) GetOptionsForOrderItems(ctx context.Context, orderItemIDs []uuid.UUID) (map[uuid.UUID][]models.OrderItemOption, error) {
	if len(orderItemIDs) == 0 {
		return map[uuid.UUID][]models.OrderItemOption{}, nil
	}
	query, args, err := sqlx.In(`
		SELECT id, order_item_id, group_id, value_id, group_name, value_name, price_delta, created_at
		FROM order_item_options
		WHERE order_item_id IN (?)
		ORDER BY order_item_id, group_name
	`, orderItemIDs)
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	var rows []models.OrderItemOption
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	result := make(map[uuid.UUID][]models.OrderItemOption)
	for _, o := range rows {
		result[o.OrderItemID] = append(result[o.OrderItemID], o)
	}
	return result, nil
}
