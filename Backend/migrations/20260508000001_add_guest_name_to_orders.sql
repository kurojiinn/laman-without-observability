-- +goose Up
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- +goose Down
ALTER TABLE orders DROP COLUMN IF EXISTS guest_name;
