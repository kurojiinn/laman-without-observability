-- +goose Up
ALTER TABLE orders
    ADD COLUMN out_of_stock_action VARCHAR(20) NULL;

-- +goose Down
ALTER TABLE orders
    DROP COLUMN out_of_stock_action;
