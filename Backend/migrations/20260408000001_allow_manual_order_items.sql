-- +goose Up
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN product_name VARCHAR(255);

-- +goose Down
DELETE FROM order_items WHERE product_id IS NULL;
ALTER TABLE order_items ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE order_items DROP COLUMN IF EXISTS product_name;
