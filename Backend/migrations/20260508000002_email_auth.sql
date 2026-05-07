-- +goose Up

-- Убираем уникальный constraint на phone (нужно для email-пользователей с phone='')
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
-- Частичный уникальный индекс: уникальность только для непустых номеров (PICKER)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_notempty_unique ON users(phone) WHERE phone != '';

-- Добавляем email-авторизацию в users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL;

-- Добавляем email в auth_codes (для email OTP)
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);

-- +goose Down
DROP INDEX IF EXISTS idx_auth_codes_email;
ALTER TABLE auth_codes DROP COLUMN IF EXISTS email;
DROP INDEX IF EXISTS users_email_unique;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users DROP COLUMN IF EXISTS email;
DROP INDEX IF EXISTS users_phone_notempty_unique;
ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
