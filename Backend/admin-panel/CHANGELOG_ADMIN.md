# CHANGELOG ADMIN
Дата: 2026-02-09

## Что сделано
- Создана базовая админ‑панель на React + Vite + Tailwind.
- Добавлены формы:
  - создание магазина
  - создание товара
  - обновление статуса заказа
- Добавлен dashboard со статистикой.
- Подключены axios и React Query.

## Обновления
- Добавлены поля ImageURL и IsAvailable для товаров.
- Добавлено удаление магазинов и товаров по ID.
- Добавлена таблица активных заказов с быстрыми статусами.
- Добавлены admin-эндпоинты:
  - `GET /api/v1/admin/orders/active`
  - `DELETE /api/v1/admin/stores/:id`
  - `DELETE /api/v1/admin/products/:id`
  - `PATCH /api/v1/admin/orders/:id`

## Требования к запуску
- Node.js 18+.
- Бэкенд запущен на `http://localhost:8080`.

## Переменные окружения
```
VITE_API_BASE_URL=http://localhost:8080
```
