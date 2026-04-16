-- +goose Up
ALTER TABLE stores ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Ойсхар';
UPDATE stores SET city = 'Ойсхар' WHERE city = 'Ойсхар';

-- +goose Down
ALTER TABLE stores DROP COLUMN IF EXISTS city;
