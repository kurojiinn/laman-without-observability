-- +goose Up
-- +goose StatementBegin
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_stores_is_active;
ALTER TABLE stores DROP COLUMN IF EXISTS is_active;
-- +goose StatementEnd
