-- +goose Up
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_store_id_user_id_key;

-- +goose Down
ALTER TABLE reviews ADD CONSTRAINT reviews_store_id_user_id_key UNIQUE (store_id, user_id);
