-- +goose Up
-- +goose StatementBegin
ALTER TABLE stores ADD COLUMN lat DOUBLE PRECISION;
ALTER TABLE stores ADD COLUMN lng DOUBLE PRECISION;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE stores DROP COLUMN lat;
ALTER TABLE stores DROP COLUMN lng;
-- +goose StatementEnd
