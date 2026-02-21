# CHANGELOG v1.1.1
Дата: 2026-02-09

## Что изменено
- **iOS TabView**: возвращен общий каталог, удален профиль, порядок вкладок: Каталог / Магазины / Корзина / Заказы.
- **Каталог**: поиск по всей базе, кнопка «Оформить (X)» переводит во вкладку корзины.
- **Магазины**: добавлен поиск по названию, список категорий обновлен (Общепит, Одежда, Быт, Стройка, Аптека).
- **Store → Products**: единый UI для карточек товаров (общий компонент ProductRowView), подкатегории загружаются для конкретного магазина.

## Технические детали
### База данных
- Новые миграции:
  - `000005_add_pharmacy_store_type.up.sql` — добавлен enum `PHARMACY`.
  - `000006_seed_pharmacy_store.up.sql` — добавлен тестовый магазин «Аптека 24».

### API
- `GET /api/v1/stores` поддерживает `search` (по названию/описанию).
- `GET /api/v1/stores/{id}/subcategories` для подкатегорий магазина.

### iOS (SwiftUI)
- Добавлен `ProductRowView` для единого UI товаров.
- Добавлен `CartViewModel` (alias на `AppState`) для Preview.
- Обновлен `StoresViewModel` с поиском и дебаунсом.
- Обновлен `StoreCategoryType` с `PHARMACY` и видимыми категориями.
- Исправлен маппинг `image_url` -> `imageUrl` в модели `Product` (не отображались реальные фото).
- Обновлен компонент загрузки изображений в каталоге: фиксированный размер 80x80, `AsyncImage` с `.aspectRatio(.fill)`, вывод ошибки загрузки в лог и fallback "No Photo" при пустом/битом URL.

## Инструкция по обновлению
1. Применить миграции:
   - `docker compose run --rm migrate -path=/migrations -database="postgres://postgres:postgres@postgres:5432/laman?sslmode=disable" up`
2. Пересобрать API:
   - `docker compose up -d --build`
3. Пересобрать iOS приложение:
   - Xcode: Cmd+Shift+K, затем Cmd+R
