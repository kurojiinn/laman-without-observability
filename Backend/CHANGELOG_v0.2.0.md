# CHANGELOG v0.2.0
Дата: 2026-02-08

## Изменено
- Catalog: поиск по товарам, фильтрация по подкатегориям, новый endpoint подкатегорий.
- Orders: сохранение и возврат `payment_method`.
- iOS UI: поиск, подкатегории (чипсы), суммарный вес в корзине, выбор способа оплаты, валидация формы, корзина не теряется при смене категории.

## Технические детали
- База данных:
  - Добавлена таблица `subcategories` (id, category_id, name, timestamps).
  - В `products` добавлено поле `subcategory_id`.
  - В `orders` добавлено поле `payment_method`.
- API:
  - `GET /api/v1/catalog/products` поддерживает `search`, `subcategory_id`.
  - `GET /api/v1/catalog/subcategories?category_id=...`
- Модели:
  - `Product` содержит `subcategory_id`.
  - `Order` содержит `payment_method`.

## Инструкция по обновлению
1. Применить миграции:
   - `docker compose up -d --build` (контейнер `migrate` применит миграции)
   - или `make migrate-up`
2. Пересобрать API:
   - `docker compose up -d --build`
3. Пересобрать iOS приложение в Xcode.

## Порядок выполнения изменений
1. Создать SQL миграции.
2. Обновить модели данных в Go.
3. Обновить репозитории и сервисы.
4. Обновить хендлеры API.
5. Обновить iOS клиент.
6. Обновить CHANGELOG.
