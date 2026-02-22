-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN role varchar(50) NOT NULL DEFAULT 'CLIENT';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE users DROP COLUMN role;
-- +goose StatementEnd