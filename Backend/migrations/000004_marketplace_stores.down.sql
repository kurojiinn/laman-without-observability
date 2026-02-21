ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_store_id_fkey;

DROP INDEX IF EXISTS idx_orders_store_id;

ALTER TABLE orders
    DROP COLUMN IF EXISTS store_id;

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_store_id_fkey;

ALTER TABLE products
    ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE products
    ADD CONSTRAINT products_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;

ALTER TABLE stores
    DROP COLUMN IF EXISTS category_type,
    DROP COLUMN IF EXISTS rating,
    DROP COLUMN IF EXISTS image_url,
    DROP COLUMN IF EXISTS description;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_category_type') THEN
        DROP TYPE store_category_type;
    END IF;
END $$;
