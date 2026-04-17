-- +goose Up
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE recipes DROP COLUMN IF EXISTS store_id;
