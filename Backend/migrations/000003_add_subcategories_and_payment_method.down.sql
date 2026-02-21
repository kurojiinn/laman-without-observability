ALTER TABLE products
    DROP COLUMN IF EXISTS subcategory_id;

DROP TABLE IF EXISTS subcategories;

ALTER TABLE orders
    DROP COLUMN IF EXISTS payment_method;
