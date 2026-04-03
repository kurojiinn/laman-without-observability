# Laman Admin Panel

Админ‑панель для управления магазинами, товарами и статусами заказов.

## Запуск локально
1. Установить зависимости:
   - `npm install`
2. Запустить dev‑сервер:
   - `npm run dev -- --host 0.0.0.0 --port 5173`

## Переменные окружения
Можно задать базовый URL бэкенда:
```
VITE_API_BASE_URL=http://192.168.0.6:8080
```

## API
Все запросы к админ‑эндпоинтам идут с BasicAuth:
- `GET /api/v1/admin/dashboard/stats`
- `POST /api/v1/admin/stores`
- `POST /api/v1/admin/products`
- `PATCH /api/v1/admin/orders/:id`

По умолчанию креды:
```
ADMIN_USER=admin
ADMIN_PASSWORD=admin
```
