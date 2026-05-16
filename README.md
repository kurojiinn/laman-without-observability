# Yuhher — сервис доставки

Универсальная доставка в Грозном: продукты, еда, товары из магазинов.  
Сайт: **yuhher.ru**

---

## Что реализовано

### Клиентское приложение (Next.js PWA)
- OTP-авторизация по номеру телефона через SMS.RU + JWT
- Каталог магазинов и товаров с двухуровневыми категориями
- Поиск товаров по всем магазинам и внутри магазина
- Корзина с оформлением заказа
- Три варианта времени доставки: «сейчас», «к определённому времени», «срочная +100 ₽»
- Избранные товары (авторизованные + гостевые)
- История заказов (авторизованные + гостевые — 2 последних из localStorage)
- Push-уведомления при смене статуса заказа
- SSE-поток уведомлений в реальном времени
- Согласие на обработку персональных данных (152-ФЗ) в форме регистрации
- Юридические страницы: `/privacy-policy` и `/consent`
- Swipe-to-dismiss на всех модалках и bottomsheet'ах
- PWA: иконки, манифест, блокировка zoom
- Body-scroll-lock на iOS Safari/PWA
- Сценарии («Быстрый перекус», «Лень готовить» и др.)
- Витрина хитов и новинок
- Рецепты с привязкой к товарам
- «Перейти в магазин» открывает магазин сразу на нужной категории товара

### Панель сборщика (picker-panel)
- Авторизация по телефону + паролю
- Список заказов магазина в реальном времени (SSE)
- Детальный просмотр заказа с позициями и фото
- Смена статусов заказа
- Push + SSE уведомления клиенту при смене статуса
- Аналитика: топ-10 продаваемых товаров за день / неделю / месяц

### Админ-панель (admin-panel)
- Статистика (дашборд)
- Управление магазинами, товарами, категориями
- Активные заказы с бейджами (срочные, по расписанию)
- Express-заказы сортируются наверх
- Смена статусов заказов
- Массовый импорт товаров (Excel / CSV)
- Загрузка изображений (MinIO)

### Бэкенд (Go + Gin)
- OTP через SMS.RU + JWT с jti + Redis-блэклист (logout)
- Rate limiting: 3 попытки / 10 мин на OTP, 10 / 30 мин на вход пикера
- Каталог: магазины, категории, подкатегории, товары, варианты товаров (option groups)
- Создание и управление заказами
- Статус-машина заказа (9 состояний)
- Telegram-уведомления о новых/отменённых заказах
- SSE Hub (несколько пикеров на магазин)
- Push-уведомления (Web Push / VAPID)
- MinIO для хранения изображений
- Observability: Zap-логирование, Prometheus-метрики, Jaeger-трейсинг
- Безопасность: magic bytes проверка загружаемых файлов, CORS только продакшен-домены
- `/health` проверяет БД и Redis (503 если недоступны)

---

## Статусы заказа

```
NEW → ACCEPTED_BY_PICKER → ASSEMBLING → ASSEMBLED → WAITING_COURIER → COURIER_PICKED_UP → DELIVERING → DELIVERED
                         ↘ NEEDS_CONFIRMATION ↗
Любой статус → CANCELLED (кроме DELIVERED)
```

---

## Технический стек

| Слой | Технологии |
|------|-----------|
| Backend | Go 1.21, Gin, sqlx, Goose, golang-jwt |
| Client app | Next.js 16.2, React 19, Tailwind 4, TypeScript |
| Picker panel | Vite, React 18, TanStack Query, Zod, React Router |
| Admin panel | Vite, React 18, Axios |
| БД | PostgreSQL 15 |
| Кэш | Redis 7 |
| Файлы | MinIO |
| Proxy | nginx (HTTPS, роутинг) |
| Логирование | Zap |
| Трейсинг | OpenTelemetry + Jaeger |
| Метрики | Prometheus + Grafana |
| CI/CD | GitLab CI |
| Линтер | golangci-lint |

---

## Структура проекта

```
Laman-App/
├── Backend/                    — Go бэкенд (port 8080)
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── auth/               — OTP + JWT
│   │   ├── users/              — профиль пользователя
│   │   ├── catalog/            — магазины, категории, товары
│   │   ├── orders/             — заказы, статус-машина
│   │   ├── picker/             — панель сборщика
│   │   ├── admin/              — административная панель
│   │   ├── favorites/          — избранное
│   │   ├── events/             — SSE Hub
│   │   ├── cache/              — Redis
│   │   └── observability/      — трейсинг, Telegram
│   └── migrations/             — 35+ Goose-миграций
│
├── Frontend/
│   ├── client-app/             — Next.js PWA (port 3000)
│   ├── picker-panel/           — Vite + React (port 5174)
│   └── admin-panel/            — Vite + React (port 5173)
│
├── nginx/                      — reverse proxy, HTTPS
├── docker-compose.yml
└── .env
```

---

## Запуск

### Всё через docker compose (продакшен / стейджинг)

```bash
docker compose up -d
```

### Применить миграции

```bash
docker exec laman-api goose -dir ./migrations postgres \
  "postgres://USER:PASSWORD@postgres:5432/laman?sslmode=disable" up
```

### client-app локально (hot reload)

```bash
cd Frontend/client-app
npm install
npm run dev     # http://localhost:3000
```

### picker-panel / admin-panel локально

```bash
cd Frontend/picker-panel && npm install && npm run dev   # :5174
cd Frontend/admin-panel  && npm install && npm run dev   # :5173
```

### После изменения кода → деплой

```bash
# 1. Локально
git add <файлы>
git commit -m "feat: ..."
git push origin main

# 2. На сервере
git pull origin main
docker compose build client-app && docker compose up -d client-app
# или api:
docker compose build api && docker compose up -d api
```

---

## Публичные URL (через nginx на yuhher.ru)

| Путь | Сервис |
|------|--------|
| `/` | Client app |
| `/api/` | Go backend |
| `/admin/` | Admin panel |
| `/picker/` | Picker panel |
| `/laman-images/` | MinIO (изображения) |

---

## Роли

| Роль | Описание |
|------|----------|
| `CLIENT` | Клиент, делает заказ |
| `PICKER` | Сборщик в магазине, собирает заказ |
| `ADMIN` | Администратор (Basic Auth) |

> Сборщики создаются вручную через SQL — публичной регистрации нет.

---

## В разработке

- Онлайн-оплата (ЮKassa)
- Промокоды и скидки
- Рейтинг магазинов
- Регистрация магазинов
- Интеграция курьерской службы
