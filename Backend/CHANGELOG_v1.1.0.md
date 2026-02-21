# CHANGELOG v1.1.0
Дата: 2026-02-08

## Что изменено
- **Marketplace Stores**: добавлена сущность магазинов и разделение товаров по магазинам.
- **API**: новые эндпоинты для магазинов и товаров магазина.
- **Orders**: заказ теперь привязан к магазину (store_id), запрет заказов из разных магазинов.
- **iOS UI**: новая навигация (Магазины / Корзина / Заказы / Профиль), экраны магазинов, карточки магазинов, экран магазина с товарами, фильтры и поиск.
- **Cart**: запрет смешивания товаров из разных магазинов; удаление товаров и очистка корзины.

## Технические детали
### База данных
- Миграции:
  - `000004_marketplace_stores.up.sql`
  - `000004_marketplace_stores.down.sql`
- Новые поля:
  - `stores`: `description`, `image_url`, `rating`, `category_type`
  - `products`: `store_id` (обязательное)
  - `orders`: `store_id` (обязательное)
- Новый enum:
  - `store_category_type` (FOOD, CLOTHES, BUILDING, AUTO, HOME)

### API
- `GET /api/v1/stores` (filter: `category_type`)
- `GET /api/v1/stores/{id}`
- `GET /api/v1/stores/{id}/products` (filters: `subcategory_id`, `search`, `available_only`)
- `POST /api/v1/orders` теперь требует `store_id` (берется из товаров заказа)

### Go модели
- `Product.store_id` теперь обязательный.
- `Order.store_id` обязателен.
- `Store` расширен (description, image_url, rating, category_type).

### iOS (SwiftUI)
- Добавлены модели `Store`, `StoreCategoryType`.
- Добавлены экраны:
  - StoresHubView
  - StoreDetailView
  - StoreCardView
  - ProfileView
- Обновлен `TabView` (Каталог заменен на Магазины).
- Реализована логика "один магазин — один заказ".

## Инструкция по обновлению
1. Применить миграции и пересобрать API:
   - `docker compose up -d --build`
2. Пересобрать iOS приложение в Xcode:
   - убедиться, что все новые файлы добавлены в Target Membership.

## Порядок выполнения изменений
1. Миграции БД (stores, store_id).
2. Go модели и репозитории.
3. API handlers и сервисы.
4. iOS модели и сеть.
5. UI и бизнес-логика корзины.
6. CHANGELOG.
## Исправления
- Исправлен каст `category_type` в миграции `000004_marketplace_stores.up.sql`, чтобы корректно вставлять enum значения.
- Если миграция уже упала и `schema_migrations` в dirty-состоянии: выполнить `docker compose run --rm migrate ... force 3`, затем `... up`.

