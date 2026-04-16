-- +goose Up
CREATE TABLE featured_products (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    block_type VARCHAR(50) NOT NULL,
    position   INT         NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_featured_products_block_product
    ON featured_products(block_type, product_id);

CREATE INDEX idx_featured_products_block_position
    ON featured_products(block_type, position);

-- +goose Down
DROP TABLE IF EXISTS featured_products;
