-- +goose Up
-- +goose StatementBegin

-- Группы опций товара (например, "Порция", "Острота").
-- kind определяет UI-подсказку и наличие цены:
--   "variant" — pick-one с разными ценами (price_delta заполнен для каждого value);
--   "flag"    — pick-one без цены (просто метка для пикера/TG).
CREATE TABLE IF NOT EXISTS product_option_groups (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    kind         TEXT NOT NULL DEFAULT 'variant' CHECK (kind IN ('variant','flag')),
    is_required  BOOLEAN NOT NULL DEFAULT TRUE,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_option_groups_product_id ON product_option_groups(product_id);

-- Конкретные варианты внутри группы ("6 шт", "9 шт", "Острый", "Не острый").
-- price_delta — добавка/скидка к базовой цене товара. NULL = опция не влияет на цену
-- (используется для flag, но допустимо и в variant для значения «по умолчанию»).
CREATE TABLE IF NOT EXISTS product_option_values (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id     UUID NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    price_delta  NUMERIC(10,2),
    is_default   BOOLEAN NOT NULL DEFAULT FALSE,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_option_values_group_id ON product_option_values(group_id);

-- Snapshot выбора клиента — хранится вместе с заказом. Имена и price_delta
-- скопированы, чтобы изменение/удаление опции у товара не ломало историю.
-- ON DELETE SET NULL на ссылки, чтобы они оставались валидными для повторного заказа,
-- но снимки всё равно остаются полными.
CREATE TABLE IF NOT EXISTS order_item_options (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    group_id      UUID REFERENCES product_option_groups(id) ON DELETE SET NULL,
    value_id      UUID REFERENCES product_option_values(id) ON DELETE SET NULL,
    group_name    TEXT NOT NULL,
    value_name    TEXT NOT NULL,
    price_delta   NUMERIC(10,2),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_options_order_item_id ON order_item_options(order_item_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS order_item_options;
DROP TABLE IF EXISTS product_option_values;
DROP TABLE IF EXISTS product_option_groups;
-- +goose StatementEnd
