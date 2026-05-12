package orders

import (
	"context"

	"Laman/internal/models"
	"Laman/internal/options"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// OptionsAdapter — мост между orders.OptionsRepo и options.Repository.
// Объявлен в orders, чтобы wiring в main был коротким и orders не импортировал
// options в публичном API (он только зависит от него в адаптере).
type OptionsAdapter struct {
	Repo options.Repository
}

// NewOptionsAdapter оборачивает репозиторий опций.
func NewOptionsAdapter(repo options.Repository) *OptionsAdapter {
	return &OptionsAdapter{Repo: repo}
}

func (a *OptionsAdapter) GetValuesByIDs(ctx context.Context, ids []uuid.UUID) ([]OptionValueWithGroup, error) {
	rows, err := a.Repo.GetValuesByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]OptionValueWithGroup, len(rows))
	for i, r := range rows {
		out[i] = OptionValueWithGroup{
			ValueID:    r.ValueID,
			ValueName:  r.ValueName,
			PriceDelta: r.PriceDelta,
			GroupID:    r.GroupID,
			GroupName:  r.GroupName,
			ProductID:  r.ProductID,
			Kind:       r.Kind,
		}
	}
	return out, nil
}

func (a *OptionsAdapter) CreateOrderItemOptionTx(ctx context.Context, tx *sqlx.Tx, opt *models.OrderItemOption) error {
	return a.Repo.CreateOrderItemOptionTx(ctx, tx, opt)
}

func (a *OptionsAdapter) GetOptionsForOrderItems(ctx context.Context, orderItemIDs []uuid.UUID) (map[uuid.UUID][]models.OrderItemOption, error) {
	return a.Repo.GetOptionsForOrderItems(ctx, orderItemIDs)
}
