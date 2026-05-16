-- +goose Up
-- Разрешаем удаление товаров, даже если они есть в старых заказах.
-- product_id в order_items становится nullable; при удалении товара ставится NULL.
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
DELETE FROM order_items WHERE product_id IS NULL;
ALTER TABLE order_items ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
