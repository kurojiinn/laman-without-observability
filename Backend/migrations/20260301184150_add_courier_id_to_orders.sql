-- +goose Up
-- +goose StatementBegin
ALTER TABLE orders ADD COLUMN courier_id UUID REFERENCES users(id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE orders DROP COLUMN courier_id;
-- +goose StatementEnd