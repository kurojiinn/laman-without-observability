-- +goose Up

-- Composite-индексы для частых запросов с ORDER BY.
-- Без них Postgres использует один из индексов и сортирует результат отдельно
-- (CPU + память на сортировку). Composite позволяет читать уже отсортированно.

-- orders WHERE user_id=? ORDER BY created_at DESC — личный кабинет клиента
CREATE INDEX IF NOT EXISTS idx_orders_user_created
    ON orders(user_id, created_at DESC);

-- orders WHERE store_id=? ORDER BY created_at DESC — список заказов сборщика
CREATE INDEX IF NOT EXISTS idx_orders_store_created
    ON orders(store_id, created_at DESC);

-- products ORDER BY name — каталог сортируется по имени почти всегда
CREATE INDEX IF NOT EXISTS idx_products_name
    ON products(name);

-- pg_trgm — поиск по подстроке (ILIKE '%query%') без full table scan.
-- Без extension Postgres всегда делает seq scan для двойного wildcard.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stores_name_trgm
    ON stores USING gin (name gin_trgm_ops);

-- +goose Down
DROP INDEX IF EXISTS idx_stores_name_trgm;
DROP INDEX IF EXISTS idx_products_name_trgm;
DROP INDEX IF EXISTS idx_products_name;
DROP INDEX IF EXISTS idx_orders_store_created;
DROP INDEX IF EXISTS idx_orders_user_created;
