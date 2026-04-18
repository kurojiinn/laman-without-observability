-- +goose Up
CREATE TABLE store_category_meta (
    category_type VARCHAR(20) PRIMARY KEY,
    image_url     TEXT,
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO store_category_meta (category_type, image_url) VALUES
    ('FOOD',     'uploads/38f37db1-5a5e-4004-abe6-8d82265ba6b1.jpg'),
    ('PHARMACY', 'uploads/dc3268ee-6664-42af-8425-2bdf91bb43f8.jpg'),
    ('BUILDING', 'uploads/f1fd876b-bc08-4b30-b7f3-59e50d4d5874.jpeg'),
    ('HOME',     'uploads/62e6ef7d-ac41-440a-9373-428669e84084.jpg'),
    ('CLOTHES',  'uploads/6f410dbd-19e5-4bfb-9639-e861c146b976.jpg'),
    ('AUTO',     NULL);

-- +goose Down
DROP TABLE IF EXISTS store_category_meta;
