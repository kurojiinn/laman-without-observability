-- +goose Up
ALTER TABLE orders
    DROP COLUMN IF EXISTS guest_name,
    DROP COLUMN IF EXISTS guest_phone,
    DROP COLUMN IF EXISTS guest_address;

-- +goose Down
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS guest_name    TEXT,
    ADD COLUMN IF NOT EXISTS guest_phone   TEXT,
    ADD COLUMN IF NOT EXISTS guest_address TEXT;
