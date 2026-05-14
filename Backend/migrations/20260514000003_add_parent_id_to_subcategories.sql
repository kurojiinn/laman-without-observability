-- +goose Up
-- Делает категории магазина двухуровневыми: подкатегория ссылается на родительскую
-- категорию того же магазина. parent_id IS NULL — категория верхнего уровня.
ALTER TABLE subcategories
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES subcategories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_subcategories_parent_id ON subcategories(parent_id);

-- +goose Down
DROP INDEX IF EXISTS idx_subcategories_parent_id;
ALTER TABLE subcategories DROP COLUMN IF EXISTS parent_id;
