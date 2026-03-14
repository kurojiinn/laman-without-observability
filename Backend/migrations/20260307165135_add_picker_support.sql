-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN store_id UUID REFERENCES stores(id);
ALTER TABLE orders ADD COLUMN picker_id UUID REFERENCES users(id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users DROP COLUMN store_id;
ALTER TABLE orders DROP COLUMN picker_id;
-- +goose StatementEnd
