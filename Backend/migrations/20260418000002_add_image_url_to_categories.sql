-- +goose Up
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- +goose Down
ALTER TABLE categories DROP COLUMN IF EXISTS image_url;
