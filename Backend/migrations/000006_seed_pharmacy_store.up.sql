INSERT INTO stores (id, name, address, phone, description, image_url, rating, category_type)
SELECT uuid_generate_v4(), s.name, s.address, s.phone, s.description, s.image_url, s.rating, s.category_type::store_category_type
FROM (
    VALUES
        ('Аптека 24', 'Грозный, ул. Ханкальская 9', '+7 (999) 404-04-04', 'Лекарства и товары для здоровья', 'https://example.com/pharmacy.png', 4.6, 'PHARMACY')
) AS s(name, address, phone, description, image_url, rating, category_type)
WHERE NOT EXISTS (SELECT 1 FROM stores st WHERE st.name = s.name);
