-- Store category enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'store_category_type') THEN
        CREATE TYPE store_category_type AS ENUM ('FOOD', 'CLOTHES', 'BUILDING', 'AUTO', 'HOME');
    END IF;
END $$;

-- Extend stores table
ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS category_type store_category_type NOT NULL DEFAULT 'FOOD';

-- Insert marketplace stores if not exists
INSERT INTO stores (id, name, address, phone, description, image_url, rating, category_type)
SELECT uuid_generate_v4(), s.name, s.address, s.phone, s.description, s.image_url, s.rating, s.category_type::store_category_type
FROM (
    VALUES
        ('Додо Пицца', 'Грозный, пр. Мира 12', '+7 (999) 101-01-01', 'Пицца и напитки', 'https://example.com/dodo.png', 4.7, 'FOOD'),
        ('СтройБазар', 'Грозный, ул. Строителей 7', '+7 (999) 202-02-02', 'Материалы и инструменты', 'https://example.com/stroy.png', 4.3, 'BUILDING'),
        ('Беркат Одежда', 'Грозный, ул. Кадырова 45', '+7 (999) 303-03-03', 'Одежда и аксессуары', 'https://example.com/berkat.png', 4.5, 'CLOTHES')
) AS s(name, address, phone, description, image_url, rating, category_type)
WHERE NOT EXISTS (SELECT 1 FROM stores st WHERE st.name = s.name);

-- Ensure products have store_id and make it required
UPDATE products
SET store_id = (SELECT id FROM stores ORDER BY created_at LIMIT 1)
WHERE store_id IS NULL;

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_store_id_fkey;

ALTER TABLE products
    ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE products
    ADD CONSTRAINT products_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;

-- Add store_id to orders and require it
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS store_id UUID;

UPDATE orders o
SET store_id = p.store_id
FROM order_items oi
JOIN products p ON p.id = oi.product_id
WHERE o.id = oi.order_id AND o.store_id IS NULL;

UPDATE orders
SET store_id = (SELECT id FROM stores ORDER BY created_at LIMIT 1)
WHERE store_id IS NULL;

ALTER TABLE orders
    ALTER COLUMN store_id SET NOT NULL;

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_store_id_fkey;

ALTER TABLE orders
    ADD CONSTRAINT orders_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
