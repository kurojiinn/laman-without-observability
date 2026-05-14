-- +goose Up
-- Превращаем категории магазинов из Postgres ENUM в полноценную таблицу,
-- чтобы их можно было добавлять/редактировать/удалять из админки.
-- store_category_meta поглощается новой таблицей store_categories.

CREATE TABLE store_categories (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    image_url   TEXT,
    position    INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Базовые категории с человекочитаемыми названиями (как на клиенте).
INSERT INTO store_categories (id, name, position) VALUES
    ('FOOD',     'Еда',                1),
    ('GROCERY',  'Продукты',           2),
    ('PHARMACY', 'Аптеки',             3),
    ('SWEETS',   'Сладости и подарки', 4),
    ('HOME',     'Химия и быт',        5),
    ('BUILDING', 'Стройматериалы',     6)
ON CONFLICT (id) DO NOTHING;

-- Подтягиваем уже настроенные админом название/описание/картинку из старой таблицы.
UPDATE store_categories sc
SET name        = COALESCE(NULLIF(TRIM(scm.name), ''), sc.name),
    description = scm.description,
    image_url   = scm.image_url,
    updated_at  = NOW()
FROM store_category_meta scm
WHERE scm.category_type = sc.id;

-- Старые относительные пути картинок (uploads/...) больше не открываются после
-- переезда на MinIO — обнуляем, чтобы показывался плейсхолдер, а не битое фото.
UPDATE store_categories
SET image_url = NULL
WHERE image_url LIKE 'uploads/%';

-- stores.category_type: enum -> varchar + внешний ключ на store_categories.
ALTER TABLE stores ALTER COLUMN category_type DROP DEFAULT;
ALTER TABLE stores ALTER COLUMN category_type TYPE VARCHAR(50) USING category_type::text;
ALTER TABLE stores ALTER COLUMN category_type DROP NOT NULL;

-- Любые значения, которые реально стоят у магазинов, но не попали в seed
-- (например CLOTHES / AUTO из старого enum) — заводим как категории, чтобы FK прошёл.
INSERT INTO store_categories (id, name, position)
SELECT DISTINCT s.category_type, s.category_type, 99
FROM stores s
WHERE s.category_type IS NOT NULL
  AND s.category_type NOT IN (SELECT id FROM store_categories)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE stores
    ADD CONSTRAINT stores_category_type_fkey
    FOREIGN KEY (category_type) REFERENCES store_categories(id) ON DELETE SET NULL;

DROP TABLE store_category_meta;
DROP TYPE store_category_type;

-- +goose Down
-- Возврат к enum. Best-effort: кастомные категории (не из исходного enum)
-- сбрасываются на FOOD, иначе обратная конвертация типа невозможна.
CREATE TYPE store_category_type AS ENUM ('FOOD', 'CLOTHES', 'BUILDING', 'AUTO', 'HOME', 'PHARMACY', 'GROCERY', 'SWEETS');

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_category_type_fkey;

UPDATE stores
SET category_type = 'FOOD'
WHERE category_type IS NULL
   OR category_type NOT IN ('FOOD', 'CLOTHES', 'BUILDING', 'AUTO', 'HOME', 'PHARMACY', 'GROCERY', 'SWEETS');

ALTER TABLE stores ALTER COLUMN category_type TYPE store_category_type USING category_type::store_category_type;
ALTER TABLE stores ALTER COLUMN category_type SET NOT NULL;
ALTER TABLE stores ALTER COLUMN category_type SET DEFAULT 'FOOD';

CREATE TABLE store_category_meta (
    category_type VARCHAR(20) PRIMARY KEY,
    image_url     TEXT,
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    name          VARCHAR(100),
    description   TEXT
);

INSERT INTO store_category_meta (category_type, image_url, name, description)
SELECT id, image_url, name, description FROM store_categories;

DROP TABLE store_categories;
