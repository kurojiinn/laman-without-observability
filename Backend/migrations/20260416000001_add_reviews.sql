-- +goose Up
CREATE TABLE reviews (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    rating     INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, user_id)
);

CREATE INDEX idx_reviews_store_id ON reviews(store_id);

-- +goose Down
DROP TABLE reviews;
