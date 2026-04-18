-- +goose Up
CREATE TABLE IF NOT EXISTS featured_scenarios (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    label       VARCHAR(100) NOT NULL,
    subtitle    VARCHAR(200) NOT NULL DEFAULT '',
    section_key VARCHAR(50)  NOT NULL,
    image_url   VARCHAR(500) NOT NULL DEFAULT '',
    emoji       VARCHAR(10)  NOT NULL DEFAULT '',
    position    INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed default scenarios
INSERT INTO featured_scenarios (label, subtitle, section_key, image_url, emoji, position, is_active) VALUES
  ('Перекус',  'Быстро и вкусно',   'quick_snack', '/scenarios/еда.jpeg',        '⚡', 0, true),
  ('Для кино', 'Собери набор',       'movie_night', '/scenarios/для кино.jpeg',   '🍿', 1, true),
  ('На ужин',  'Идеи и продукты',    'lazy_cook',   '/scenarios/еда.jpeg',        '🍝', 2, true),
  ('К чаю',    'Сладкое настроение', 'new_items',   '/scenarios/сладости.jpeg',   '☕', 3, true);

-- +goose Down
DROP TABLE IF EXISTS featured_scenarios;
