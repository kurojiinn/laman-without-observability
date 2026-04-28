-- Миграция URL изображений с локального filesystem на MinIO.
-- Запускать ВРУЧНУЮ после того как MinIO поднят и все старые файлы
-- перенесены в bucket (или приняли решение что старые URL не нужны).
--
-- Замените 'http://OLD_HOST:8080' и 'http://MINIO_HOST:9000/laman-images'
-- на реальные значения перед запуском.

-- Посмотреть сколько записей затронет миграция:
SELECT 'products' AS tbl, COUNT(*) FROM products WHERE image_url LIKE '%/uploads/%'
UNION ALL
SELECT 'stores', COUNT(*) FROM stores WHERE image_url LIKE '%/uploads/%'
UNION ALL
SELECT 'recipes', COUNT(*) FROM recipes WHERE image_url LIKE '%/uploads/%'
UNION ALL
SELECT 'categories', COUNT(*) FROM categories WHERE image_url LIKE '%/uploads/%'
UNION ALL
SELECT 'featured_scenarios', COUNT(*) FROM featured_scenarios WHERE image_url LIKE '%/uploads/%'
UNION ALL
SELECT 'store_category_meta', COUNT(*) FROM store_category_meta WHERE image_url LIKE '%/uploads/%';

-- Обновить URL (раскомментировать после проверки счётчиков выше):
/*
UPDATE products
SET image_url = REPLACE(image_url, 'http://OLD_HOST:8080/uploads/', 'http://MINIO_HOST:9000/laman-images/')
WHERE image_url LIKE '%/uploads/%';

UPDATE stores
SET image_url = REPLACE(image_url, 'http://OLD_HOST:8080/uploads/', 'http://MINIO_HOST:9000/laman-images/')
WHERE image_url LIKE '%/uploads/%';

UPDATE recipes
SET image_url = REPLACE(image_url, 'http://OLD_HOST:8080/uploads/', 'http://MINIO_HOST:9000/laman-images/')
WHERE image_url LIKE '%/uploads/%';

UPDATE categories
SET image_url = REPLACE(image_url, 'http://OLD_HOST:8080/uploads/', 'http://MINIO_HOST:9000/laman-images/')
WHERE image_url LIKE '%/uploads/%';

UPDATE featured_scenarios
SET image_url = REPLACE(image_url, 'http://OLD_HOST:8080/uploads/', 'http://MINIO_HOST:9000/laman-images/')
WHERE image_url LIKE '%/uploads/%';

UPDATE store_category_meta
SET image_url = REPLACE(image_url, 'http://OLD_HOST:8080/uploads/', 'http://MINIO_HOST:9000/laman-images/')
WHERE image_url LIKE '%/uploads/%';
*/
