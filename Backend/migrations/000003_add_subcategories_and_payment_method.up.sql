-- Add subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add subcategory to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

-- Add payment method to orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'CASH';

-- Seed subcategories for "Стройматериалы"
INSERT INTO subcategories (id, category_id, name)
SELECT uuid_generate_v4(), c.id, s.name
FROM categories c
JOIN (VALUES ('Краски'), ('Смеси'), ('Инструменты')) AS s(name) ON TRUE
WHERE c.name = 'Стройматериалы'
  AND NOT EXISTS (
      SELECT 1 FROM subcategories sc WHERE sc.category_id = c.id AND sc.name = s.name
  );

-- Map existing products to subcategories
UPDATE products p
SET subcategory_id = sc.id
FROM categories c
JOIN subcategories sc ON sc.category_id = c.id
WHERE p.category_id = c.id
  AND c.name = 'Стройматериалы'
  AND (
      (p.name ILIKE '%краска%' AND sc.name = 'Краски') OR
      (p.name ILIKE '%цемент%' AND sc.name = 'Смеси') OR
      (p.name ILIKE '%инструмент%' AND sc.name = 'Инструменты')
  );
