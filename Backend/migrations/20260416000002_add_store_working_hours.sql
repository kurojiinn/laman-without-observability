-- +goose Up
ALTER TABLE stores
    ADD COLUMN opens_at VARCHAR(5) NULL,
    ADD COLUMN closes_at VARCHAR(5) NULL;

-- +goose Down
ALTER TABLE stores
    DROP COLUMN opens_at,
    DROP COLUMN closes_at;
