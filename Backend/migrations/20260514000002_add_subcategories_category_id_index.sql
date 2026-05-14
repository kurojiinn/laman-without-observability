-- +goose Up
-- Ускоряет выборку дерева категорий: подкатегории группируются по category_id
-- (GET /catalog/categories с children, GET /stores/:id/category-tree).
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);

-- +goose Down
DROP INDEX IF EXISTS idx_subcategories_category_id;
