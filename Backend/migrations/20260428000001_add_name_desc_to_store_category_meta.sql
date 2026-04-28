-- +goose Up
ALTER TABLE store_category_meta
    ADD COLUMN IF NOT EXISTS name        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE store_category_meta SET name = 'Продукты',      description = 'Продукты питания и напитки'    WHERE category_type = 'FOOD';
UPDATE store_category_meta SET name = 'Аптека',         description = 'Лекарства и медтовары'         WHERE category_type = 'PHARMACY';
UPDATE store_category_meta SET name = 'Стройматериалы', description = 'Товары для строительства'      WHERE category_type = 'BUILDING';
UPDATE store_category_meta SET name = 'Дом',            description = 'Товары для дома'               WHERE category_type = 'HOME';
UPDATE store_category_meta SET name = 'Одежда',         description = 'Одежда и аксессуары'           WHERE category_type = 'CLOTHES';
UPDATE store_category_meta SET name = 'Авто',           description = 'Товары для автомобиля'         WHERE category_type = 'AUTO';

-- +goose Down
ALTER TABLE store_category_meta
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description;
