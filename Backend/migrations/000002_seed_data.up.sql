-- Seed categories
INSERT INTO categories (id, name, description) VALUES
    (uuid_generate_v4(), 'Продукты', 'Продукты питания и напитки'),
    (uuid_generate_v4(), 'Бытовые товары', 'Товары для дома и быта'),
    (uuid_generate_v4(), 'Стройматериалы', 'Материалы для строительства и ремонта'),
    (uuid_generate_v4(), 'Электроника', 'Электронные устройства и аксессуары');

-- Seed stores
INSERT INTO stores (id, name, address, phone) VALUES
    (uuid_generate_v4(), 'Магазин "У дома"', 'ул. Ленина, 10', '+7 (999) 123-45-67'),
    (uuid_generate_v4(), 'Супермаркет "Вкусный"', 'пр. Мира, 25', '+7 (999) 234-56-78'),
    (uuid_generate_v4(), 'Строймаркет "Стройка"', 'ул. Строителей, 5', '+7 (999) 345-67-89');

-- Seed products (using subqueries to get category and store IDs)
INSERT INTO products (id, category_id, store_id, name, description, price, weight, is_available)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Продукты' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Магазин "У дома"' LIMIT 1),
    'Хлеб белый',
    'Свежий белый хлеб',
    50.00,
    0.5,
    TRUE
UNION ALL
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Продукты' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Магазин "У дома"' LIMIT 1),
    'Молоко 1л',
    'Молоко пастеризованное',
    80.00,
    1.0,
    TRUE
UNION ALL
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Продукты' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Супермаркет "Вкусный"' LIMIT 1),
    'Яйца куриные (10 шт)',
    'Яйца куриные категории С0',
    120.00,
    0.6,
    TRUE
UNION ALL
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Бытовые товары' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Магазин "У дома"' LIMIT 1),
    'Мыло хозяйственное',
    'Мыло хозяйственное 200г',
    30.00,
    0.2,
    TRUE
UNION ALL
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Бытовые товары' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Супермаркет "Вкусный"' LIMIT 1),
    'Стиральный порошок 3кг',
    'Стиральный порошок для белого белья',
    450.00,
    3.0,
    TRUE
UNION ALL
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Стройматериалы' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Строймаркет "Стройка"' LIMIT 1),
    'Цемент 50кг',
    'Цемент М400',
    350.00,
    50.0,
    TRUE
UNION ALL
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM categories WHERE name = 'Стройматериалы' LIMIT 1),
    (SELECT id FROM stores WHERE name = 'Строймаркет "Стройка"' LIMIT 1),
    'Краска белая 10л',
    'Водоэмульсионная краска',
    1200.00,
    12.0,
    TRUE;
