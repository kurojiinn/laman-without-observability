-- +goose Up
CREATE TABLE recipes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    image_url   VARCHAR(500),
    position    INT         NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recipe_products (
    recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity   INT  NOT NULL DEFAULT 1,
    PRIMARY KEY (recipe_id, product_id)
);

CREATE INDEX idx_recipe_products_recipe ON recipe_products(recipe_id);

-- +goose Down
DROP TABLE IF EXISTS recipe_products;
DROP TABLE IF EXISTS recipes;
