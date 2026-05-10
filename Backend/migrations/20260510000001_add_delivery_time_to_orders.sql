-- +goose Up
ALTER TABLE orders
    ADD COLUMN delivery_type VARCHAR(20) NOT NULL DEFAULT 'now'
        CHECK (delivery_type IN ('now', 'scheduled', 'express'));
ALTER TABLE orders
    ADD COLUMN scheduled_at TIMESTAMPTZ NULL;
ALTER TABLE orders
    ADD COLUMN delivery_surcharge INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_surcharge;
ALTER TABLE orders DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE orders DROP COLUMN IF EXISTS delivery_type;
