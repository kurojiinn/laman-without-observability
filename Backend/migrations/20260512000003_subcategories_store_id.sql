-- +goose Up
-- +goose StatementBegin
-- Магазин-локальные подкатегории: store_id заполнен, category_id может быть NULL.
-- Глобальные подкатегории (как раньше) — store_id IS NULL.
ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE subcategories
    ALTER COLUMN category_id DROP NOT NULL;

ALTER TABLE subcategories
    DROP CONSTRAINT IF EXISTS subcategories_has_parent;

ALTER TABLE subcategories
    ADD CONSTRAINT subcategories_has_parent
    CHECK (category_id IS NOT NULL OR store_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_subcategories_store_id ON subcategories(store_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_subcategories_store_id;
ALTER TABLE subcategories DROP CONSTRAINT IF EXISTS subcategories_has_parent;
-- Возврат NOT NULL может упасть, если есть строки с category_id IS NULL — даунгрейд требует ручной очистки.
ALTER TABLE subcategories ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE subcategories DROP COLUMN IF EXISTS store_id;
-- +goose StatementEnd
