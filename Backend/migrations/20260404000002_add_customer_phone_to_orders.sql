-- +goose Up
-- +goose StatementBegin
ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(20);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE orders DROP COLUMN customer_phone;
-- +goose StatementEnd
