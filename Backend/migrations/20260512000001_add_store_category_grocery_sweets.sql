-- +goose Up
-- +goose NO TRANSACTION
-- Добавляем недостающие значения enum: код (Go/админка/клиент) уже использует
-- GROCERY и SWEETS, но в БД они не были созданы — INSERT/UPDATE падал.
ALTER TYPE store_category_type ADD VALUE IF NOT EXISTS 'GROCERY';
ALTER TYPE store_category_type ADD VALUE IF NOT EXISTS 'SWEETS';

-- +goose Down
-- Postgres не позволяет удалить значение из enum без пересоздания типа.
SELECT 1;
