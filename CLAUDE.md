
# Laman — сервис доставки

## О проекте
Стартап универсальной доставки в Грозном (400к население).
Сервис доставки "чего угодно" — продукты, еда, товары из магазинов.

## Репозитории
- GitHub: git@github.com:kurojiinn/laman-without-observability.git (origin) — основной, push сюда
- GitLab: git@gitlab.com:Khadzhiev404/laman-backend.git (gitlab) — устарел, ветки расходятся, не пушить

---

## Структура проекта

```
Laman-App/
├── Backend/                    ← Go бэкенд (Gin, port 8080)
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── auth/               — OTP SMS + JWT авторизация
│   │   ├── users/              — профиль пользователя
│   │   ├── catalog/            — категории, подкатегории, товары, магазины
│   │   ├── orders/             — создание и управление заказами
│   │   ├── picker/             — панель сборщика (SSE, заказы, статусы)
│   │   ├── admin/              — административная панель
│   │   ├── favorites/          — избранные товары
│   │   ├── models/             — общие модели (Order, User, Product, ...)
│   │   ├── middleware/         — Auth, Logging, Metrics, CORS, Recovery
│   │   ├── observability/      — Jaeger трейсинг, Telegram уведомления
│   │   ├── events/             — SSE Hub для real-time уведомлений
│   │   ├── cache/              — Redis клиент
│   │   ├── config/             — конфигурация через env переменные
│   │   ├── delivery/           — доставка
│   │   └── payments/           — оплата
│   ├── migrations/             — SQL миграции (Goose, 14 файлов)
│   ├── docker/
│   │   ├── grafana/            — provisioning конфиги
│   │   └── prometheus/         — prometheus.yml
│   ├── uploads/                — загруженные файлы
│   └── Dockerfile              — multi-stage build (golang → alpine)
│
├── nginx/                      ← Reverse proxy (HTTPS termination, роутинг)
│   ├── nginx.conf              — конфиг: /api/ → backend, /admin/ → admin, /picker/ → picker, / → client-app
│   └── certs/                  — SSL сертификаты (cert.pem + key.pem, не в git)
│
├── Frontend/
│   ├── client-app/             ← Next.js (клиентское приложение, внутренний port 3000)
│   │   ├── src/app/            — App Router страницы (каталог, корзина, заказы, профиль)
│   │   ├── src/components/     — React компоненты
│   │   ├── src/context/        — Auth, Cart, Favorites контексты
│   │   ├── src/lib/            — API клиент
│   │   ├── next.config.ts      — минимальная конфигурация (НЕТ прокси)
│   │   └── Dockerfile          — production build
│   │
│   ├── picker-panel/           ← Vite + React 18 (панель сборщика, port 5174)
│   │   ├── src/
│   │   │   ├── app/router.tsx      — React Router маршруты
│   │   │   ├── entities/order/     — модели OrderItem, PickerOrder, статусы
│   │   │   ├── features/orders/    — api.ts (fetch+zod), hooks.ts (react-query)
│   │   │   ├── pages/
│   │   │   │   ├── login/          — LoginPage
│   │   │   │   ├── orders/         — OrdersPage (список)
│   │   │   │   └── order-details/  — OrderDetailsPage (детали + товары)
│   │   │   └── shared/             — AppShell, http клиент, форматтеры
│   │   ├── dist/               — старый статичный билд (НЕ используется в dev)
│   │   ├── vite.config.ts      — port 5174, НЕТ API прокси
│   │   └── Dockerfile          — запускает npm run dev (не prod билд!)
│   │
│   └── admin-panel/            ← Vite + React 18 (admin, port 5173)
│       ├── src/                — Admin UI
│       ├── vite.config.ts      — port 5173
│       └── Dockerfile          — запускает npm run dev
│
├── docker-compose.yml          ← Основной способ запуска (7 сервисов + nginx)
├── .env                        — HOST_IP=192.168.0.104 (локальный IP машины)
├── Makefile                    — команды для бэкенда
└── .gitlab-ci.yml              — CI/CD: lint → build → deploy_staging → deploy_prod
```

---

## Как запускать

### Всё через docker-compose (рекомендуется)
```bash
# Поднять всё (бэкенд + БД + Redis + Jaeger + admin-panel + picker-panel)
docker-compose up -d

# Пересобрать конкретный сервис после изменений в коде
docker-compose build picker-panel && docker-compose up -d picker-panel
docker-compose build api && docker-compose up -d api

# Посмотреть логи
docker-compose logs -f api
docker-compose logs -f picker-panel
```

### client-app (Next.js) — через docker-compose или локально
```bash
# Через docker-compose (рекомендуется — prod-like через nginx):
docker-compose up -d client-app

# Локально для разработки (hot reload без пересборки образа):
cd Frontend/client-app
npm install
npm run dev        # http://localhost:3000
# ⚠️ При локальном запуске API URL берётся из .env.local → NEXT_PUBLIC_API_URL
```

### picker-panel — для разработки запускай локально
```bash
# Docker контейнер запускает npm run dev, но исходники не маунтятся →
# изменения в коде НЕ попадают в контейнер без пересборки образа.
# Лучше при разработке запускать локально:
cd Frontend/picker-panel
npm install
npm run dev        # http://localhost:5174
```

### admin-panel — аналогично picker-panel
```bash
cd Frontend/admin-panel
npm install
npm run dev        # http://localhost:5173
# ИЛИ через docker-compose (но пересборка нужна при изменениях)
```

### Backend отдельно (без docker)
```bash
cd Backend
go run ./cmd/api   # нужны запущенные postgres и redis
# ИЛИ
make run
```

### ⚠️ dist/ в picker-panel
`Frontend/picker-panel/dist/` — это старый статичный билд. Он НЕ используется
при запуске через `npm run dev` или Docker. Если нужно обновить prod билд:
```bash
cd Frontend/picker-panel && npm run build
```

---

## Сервисы в docker-compose

| Сервис       | Образ / Dockerfile                     | Порт (внешний) | Зависит от          |
|--------------|----------------------------------------|----------------|---------------------|
| postgres     | postgres:15-alpine                     | internal       | —                   |
| redis        | redis:7-alpine                         | internal       | —                   |
| minio        | minio/minio:latest                     | internal       | —                   |
| api          | ./Backend/Dockerfile                   | 8080 (→ nginx) | postgres, redis     |
| client-app   | ./Frontend/client-app/Dockerfile       | internal 3000  | api, minio          |
| admin-panel  | ./Frontend/admin-panel/Dockerfile      | internal 5173  | api                 |
| picker-panel | ./Frontend/picker-panel/Dockerfile     | internal 5174  | api                 |
| nginx        | nginx:alpine                           | **80, 443**    | api, client-app     |

> Jaeger, Prometheus, Grafana убраны из docker-compose. Поднимать при необходимости отдельно.

**Публичные URL через nginx (https://HOST_IP):**

| Путь        | Сервис                 |
|-------------|------------------------|
| `/api/`     | Go backend (api:8080)  |
| `/admin/`   | Admin panel (:5173)    |
| `/picker/`  | Picker panel (:5174)   |
| `/laman-images/` | MinIO (minio:9000) |
| `/`         | Client app (:3000)     |

Конфиг: `.env` файл в корне, `HOST_IP` — IP машины в локальной сети.
Все сервисы доступны только через nginx: `https://${HOST_IP}` (порт 443).

---

## Технический стек

- **Backend**: Go + Gin framework
- **Client app**: Next.js 16.2 + React 19 + Tailwind 4
- **Picker panel**: Vite + React 18 + React Router + TanStack Query + Zod
- **Admin panel**: Vite + React 18 + Axios
- **БД**: PostgreSQL 15
- **Кэш**: Redis 7
- **Миграции**: Goose (запуск вручную: `cd Backend && make migrate-up`)
- **Трейсинг**: Jaeger + OpenTelemetry
- **Метрики**: Prometheus + Grafana
- **Логирование**: Zap
- **CI/CD**: GitLab CI
- **JWT авторизация**: golang-jwt
- **Линтер**: golangci-lint

---

## Роли в системе
- **CLIENT** — клиент, делает заказ через web
- **PICKER** — сборщик в магазине, собирает заказ
- **ADMIN** — администратор системы (BasicAuth admin-panel)

> Курьерская доставка делается вручную через Telegram-группу администрации.
> Роль COURIER и связанная логика удалены — будут добавлены при интеграции
> с курьерской службой или собственным курьерским приложением.

Все роли хранятся в таблице `users` с полем `role`.

---

## Ключевые модели

```go
User    { ID, Phone, Role, StoreID, PasswordHash, CreatedAt, UpdatedAt }
Order   { ID, UserID, PickerID, StoreID, Status, PaymentMethod,
          ItemsTotal, ServiceFee, DeliveryFee, DeliverySurcharge, FinalTotal,
          DeliveryType, ScheduledAt, ... }
Store   { ID, Name, Lat, Lng, ... }
Product { ID, StoreID, Name, Price, ImageURL, ... }
OrderItem { ID, OrderID, ProductID, Quantity, Price }
```

`DeliveryType` ∈ {`now`, `scheduled`, `express`}. `ScheduledAt` заполнен только для `scheduled`,
`DeliverySurcharge=100` ставится бэком принудительно для `express` (фронту не доверяем).

> Поле `Order.CourierID` сохранено в БД, но не используется кодом до появления
> курьерской интеграции.

---

## Статусы заказа

```
NEW → ACCEPTED_BY_PICKER → ASSEMBLING → ASSEMBLED → WAITING_COURIER → COURIER_PICKED_UP → DELIVERING → DELIVERED
                         ↘ NEEDS_CONFIRMATION ↗
Любой статус → CANCELLED (кроме DELIVERED)
```

---

## API эндпоинты (base: https://HOST_IP/api)

### Auth
```
POST /api/v1/auth/request-code
POST /api/v1/auth/verify-code
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### Orders
```
POST /api/v1/orders              — создание (поля: items, delivery_address,
                                   payment_method, delivery_type, scheduled_at,
                                   delivery_surcharge, out_of_stock_action, comment)
GET  /api/v1/orders/:id          — получить заказ (только владелец)
GET  /api/v1/orders              — список заказов клиента (?limit, ?offset)
POST /api/v1/orders/:id/cancel   — отмена клиентом
GET  /api/v1/orders/events       — SSE поток уведомлений клиенту
                                   (типы: order_status_changed, order_updated)
```

### Picker
```
POST /api/v1/picker/auth/login                     — логин (phone + password)
GET  /api/v1/picker                                — список заказов магазина (без items!)
GET  /api/v1/picker/orders/:id                     — конкретный заказ (с items + image_url)
PUT  /api/v1/picker/orders/:id/status              — обновить статус (шлёт push+SSE клиенту)
POST /api/v1/picker/orders/:id/items               — добавить товар в заказ
DELETE /api/v1/picker/orders/:id/items/:itemId     — удалить товар
GET  /api/v1/picker/analytics/top-products?period= — топ-10 товаров (period=day|week|month)
GET  /api/v1/picker/events                         — SSE поток уведомлений
```

### Admin
```
GET  /api/v1/admin/dashboard/stats
GET  /api/v1/admin/orders/active
POST /api/v1/admin/stores
POST /api/v1/admin/products
```

---

## CI/CD (GitLab)
```
lint → build → deploy_staging (auto) → deploy_prod (manual)
```
- Runner: локальный shell runner, тег `local`
- Registry: registry.gitlab.com/khadzhiev404/laman-backend
- `brew services start gitlab-runner` — запуск runner'а

---

## Что реализовано
- OTP авторизация через SMS.RU (только `/auth/request-code` + `/auth/verify`)
- JWT токены с jti + Redis-блэклист (logout работает для клиентов и пикеров)
- Каталог товаров и магазинов
- Создание заказов (гостевые + авторизованные)
- Telegram уведомления админу о новых/отменённых заказах
- Observability: трейсинг, метрики, логирование
- CI/CD GitLab pipeline
- Панель сборщика — бэкенд + фронт (picker-panel)
- SSE уведомления для сборщика и клиента (Hub поддерживает несколько пикеров на магазин)
- Push-уведомления клиенту при смене статуса заказа — работает и от админа, и от пикера
  (раньше пикер только обновлял БД и клиент ничего не получал)
- **Время доставки** в чекауте: «привезти сейчас», «указать время», «срочная +100 ₽»
  - DeliveryTimePicker — bottomsheet с кастомным календарём на 7 дней
  - Динамические 2-часовые слоты для сегодня (от ceil(now+2ч), шаг 2ч, до start<22),
    фиксированный 8–22 для будущих дней
  - Бэк валидирует: 8:00–22:00 в MSK, минимум +2ч, доплата 100 ₽ за express
    проставляется принудительно (фронту не доверяем)
  - Picker видит тип доставки в списке и на странице заказа («⚡ Срочная», «🕕 11 мая в 18:00»)
  - Admin: бейджи в списке заказов, express-заказы сортируются наверх
- **Гостевая история заказов** — для незарегистрированных вкладка «Заказы / Избранное»
  с последними 2 заказами из localStorage (`yuhher_guest_orders`) + CTA-плашка
  «Войдите чтобы сохранить историю»
- **Аналитика для сборщика** — топ-10 продаваемых товаров за день/неделю/месяц
  (агрегация по имени товара, без отменённых заказов)
- Swipe-to-dismiss на всех модалках: hook `useSwipeToDismiss` (`src/hooks/useSwipeToDismiss.ts`)
  - Bottom sheets (ProductModal, PromoModal, CharityModal, ProfileDrawer, AuthModal,
    DeliveryTimePicker): drag handle + свайп вниз
  - Fullscreen (ShowcasePage, RecipesModal, RecipeDetailModal): свайп вниз по хедеру
  - PromoModal и CharityModal переведены на createPortal (fix backdrop не доходил до верха)
- PWA жёстко запинен по zoom (maximumScale=1, userScalable=false) — нельзя разъехать
  pinch'ом или двойным тапом
- Body-scroll-lock через `useBodyScrollLockWhen` (position:fixed) — единственный способ
  удержать страницу под открытой модалкой в iOS Safari/PWA, простой overflow:hidden там игнорируется
- Безопасность: аудит и исправление критических уязвимостей (см. ниже)

## Что в разработке
- TASK-009: Push уведомления клиенту
- TASK-010: Онлайн оплата (ЮKassa)
- TASK-011: Промокоды и скидки
- TASK-012: Рейтинг магазинов
- TASK-013: Регистрация магазинов
- TASK-014: Интеграция курьерской службы (или собственное курьерское приложение)

## Технический долг

### Пагинация (MEDIUM приоритет)
Все list-эндпоинты возвращают все записи без ограничения.
При росте данных это вызовет проблемы с производительностью.

**Затронутые эндпоинты:**
- `GET /orders` — заказы пользователя
- `GET /admin/orders` — все заказы в системе
- `GET /picker` — заказы магазина
- `GET /products` и другие каталожные эндпоинты

**Формат который нужно реализовать:**
```
GET /orders?page=1&limit=20
→ { data: [...], total: 150, page: 1, limit: 20 }
```

### Postgres SSL (LOW приоритет)
В продакшене `DB_SSLMODE=disable`. Для внешнего Postgres нужно `require`.
Текущий Postgres внутри Docker-сети — приемлемо пока не выносится наружу.

### Регрессионные тесты auth (LOW приоритет)
Нет unit/integration тестов для пакета `internal/auth`.
Особенно важно покрыть: OTP flow, JWT валидацию, rate limiting.

---

## Безопасность — что сделано

Полный аудит проведён, все критические и большинство medium уязвимостей закрыты.

### Аутентификация
- `/auth/login` удалён — был критический bypass (JWT по одному лишь phone)
- `/auth/send-code` удалён — не было rate limit, OTP в stdout
- `Register` всегда создаёт CLIENT — PICKER самостоятельно зарегистрироваться не может
- `?token=` query param принимается ТОЛЬКО на SSE-эндпоинтах (`SSEAuthMiddleware`)
- Picker JWT теперь содержит `jti` → logout работает через Redis-блэклист
- Logout на просроченном токене возвращает 200 (раньше был 500)

### Rate limiting
- `/auth/request-code`: 3 запроса / 10 мин по номеру телефона
- `/auth/verify` / `/auth/verify-code`: 5 попыток / 15 мин
- `/auth/check-user`: 20 запросов / 1 мин по IP
- `/picker/auth/login`: 10 попыток / 30 мин по IP
- `router.SetTrustedProxies(["127.0.0.1"])` → IP не спуфится через заголовки

### Загрузка файлов
- Изображения: проверка magic bytes (JPEG, PNG, GIF, WebP)
- Импорт (xlsx/xls/csv): проверка расширения + magic bytes, лимит 5MB
- Глобальный лимит тела запроса: 10MB

### Прочее
- CORS: только продакшен-домены, без localhost
- SMS API ключ не попадает в логи (URL логируется без `api_id`)
- MinIO: ротированы дефолтные слабые ключи
- `/health` проверяет БД и Redis (возвращает 503 если недоступны)
- SSE Hub: несколько пикеров на магазин — каждый получает отдельный канал

---

## Принципы разработки
1. Интерфейсы определяются на стороне потребителя
2. Не игнорируй ошибки — отсутствие данных не ошибка
3. Interface Segregation — минимальный интерфейс
4. Один метод — одна ответственность
5. Early return — не вложенные if-ы
6. Не дублируй код — общая логика в shared пакете
7. Graceful degradation — незаполненный env не ломает сервис
8. Статусы отражают реальный бизнес процесс
9. Явные переходы между статусами — State Machine

---

## Важные заметки
- `.env` и `secrets.yaml` никогда не коммитить в git
- Всегда используй `%w` при оборачивании ошибок в Go
- Линтер перед каждым коммитом: `golangci-lint run ./...`
- Миграции запускаются вручную: `cd Backend && make migrate-up` (postgres должен быть запущен)
- `dist/` в picker-panel — старый билд, не используется в dev режиме
- picker-panel и admin-panel Docker образы делают `npm run build` → nginx (prod сборка)
  → при изменении кода нужно пересобирать образ: `docker-compose build <service>`
  → для активной разработки лучше запускать `npm run dev` локально
- После изменения `.env` на сервере: `docker compose up -d api` (пересборка не нужна)

## Время доставки — модель

В таблице `orders` три колонки (миграция `20260510000001_add_delivery_time_to_orders.sql`):
- `delivery_type VARCHAR(20) NOT NULL DEFAULT 'now'` с CHECK на `('now','scheduled','express')`
- `scheduled_at TIMESTAMPTZ NULL` — заполнен только для `scheduled`
- `delivery_surcharge INTEGER NOT NULL DEFAULT 0` — для `express` бэк ставит 100 принудительно

**Backend валидация** (в `internal/orders/handler.go`, функция `normalizeDeliveryTime`):
- `delivery_type=""` → ставится `now`
- неизвестный тип → 400 `invalid delivery_type`
- `scheduled` без `scheduled_at` → 400
- `scheduled_at < now+2ч` → 400 `scheduled_at must be at least 2 hours from now`
- час `scheduled_at` (в `Europe/Moscow`) вне `[8;22)` → 400 `delivery available only 8:00–22:00`

**Часовой пояс**: фронт шлёт `toISOString()` в UTC, бэк парсит и конвертирует в MSK (через
`time.FixedZone("MSK", 3*3600)`) — иначе локальное «20:00» из браузера превращалось бы в «17».

**Расчёт итога**: `final_total = items_total + service_fee + delivery_fee + delivery_surcharge`.

**Фронт (DeliveryTimePicker)** генерирует слоты:
- Сегодня — от `ceil(now+2ч)` до `start<22`, шаг 2 часа. Если now ≥ 19:30 — слотов нет, чип «Сегодня» дизейблится.
- Завтра и далее — фиксированный набор 7 окон: 8–10, 10–12, …, 20–22.

---

## Push-уведомления статусов заказа

Push отправляется клиенту при смене статуса из обоих путей:
- `orders.OrderService.UpdateOrderStatus` (админка) — через `s.pusher.SendToUser`
- `picker.Service.UpdateStatus` (сборщик) — добавлено симметрично, раньше отсутствовало

Обе ветки также пишут SSE-payload в `events.Hub` для `userID` (тип `order_status_changed`).
Если у picker'а появится новый код пути обновления статуса — не забыть продублировать обе посылки.

VAPID-ключи в env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` — без них push молча no-op'ится.

---

## OTP / SMS — текущее состояние

- На сервере `SMS_RU_TEST=true` — реальные SMS не отправляются, баланс не тратится
- В dev режиме OTP код виден в логах: `docker compose logs -f api | grep dev_otp`
- OTP также отправляется в Telegram (бот `TG_BOT_TOKEN`), но **нестабильно** —
  московский хостинг блокирует `api.telegram.org`, сообщения иногда доходят иногда нет
- OTP истекает через **5 минут** (`service.go`: `ExpiresAt: time.Now().Add(5 * time.Minute)`)
- Когда SMS.RU будет подключён: поставить `SMS_RU_TEST=false` и перезапустить api

## Создание сборщика (PICKER) через SQL

Сборщики создаются вручную — публичной регистрации нет.
Обязательно указывать `store_id` (к какому магазину привязан).

```bash
# 1. Установить расширение для хэширования паролей (один раз)
docker compose exec postgres psql -U postgres -d laman -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 2. Создать сборщика
docker compose exec postgres psql -U postgres -d laman -c "
INSERT INTO users (id, phone, role, password_hash, store_id, created_at, updated_at)
VALUES (gen_random_uuid(), '7XXXXXXXXXX', 'PICKER', crypt('пароль', gen_salt('bf')), 'store-uuid', NOW(), NOW());
"

# Посмотреть список магазинов (для store-uuid)
docker compose exec postgres psql -U postgres -d laman -c "SELECT id, name FROM stores;"

# Посмотреть всех сборщиков
docker compose exec postgres psql -U postgres -d laman -c "SELECT id, phone, store_id FROM users WHERE role = 'PICKER';"
```

---

## Смена IP-адреса (HOST_IP)

**Текущий хост: `yuhher.ru`** (сервер: `89.169.1.162`)

При смене домена/IP заменить старый адрес на новый в **5 файлах** (проще всего через глобальный поиск-замену в IDE):

### `.env` — 5 мест
```
HOST_IP=<новый_ip>
PUBLIC_URL=http://<новый_ip>:8080
VITE_API_BASE_URL=http://<новый_ip>:8080
CORS_ORIGINS=...http://<новый_ip>:3000,http://<новый_ip>:5173,http://<новый_ip>:5174
MINIO_PUBLIC_URL=http://<новый_ip>:9000
```

### `Frontend/client-app/.env.local` — 1 место
```
NEXT_PUBLIC_API_URL=http://<новый_ip>:8080/api
```

### `Frontend/client-app/next.config.ts` — 2 места
```ts
allowedDevOrigins: ["<новый_ip>"],
allowedOrigins: ["<новый_ip>:3000", "localhost:3000"],
```

### `Frontend/admin-panel/.env` — 1 место
```
VITE_API_BASE_URL=http://<новый_ip>:8080
```

### `Frontend/picker-panel/.env` — 1 место
```
VITE_API_BASE_URL=http://<новый_ip>:8080
```

`docker-compose.yml` — **не трогать**: все URL строятся через `${HOST_IP}` автоматически.

### Как отображаются картинки (MinIO)
- Картинки хранятся в MinIO, отдаются через nginx по пути `/laman-images/`
- URL картинок в БД формируется как `MINIO_PUBLIC_URL + /laman-images/ + filename`
- На фронте функция `resolveImageUrl()` (в `src/lib/api.ts`) автоматически заменяет
  хост в URL на `window.location.origin` (тот же origin что и сайт, порт 9000 не нужен)
  — поэтому старые URL из БД со старым IP всё равно работают после смены IP
- **Важно**: все `<img src={...}>` в компонентах обязаны использовать `resolveImageUrl()`,
  иначе после смены IP картинки сломаются. Проверь компоненты:
  - `src/components/catalog/CatalogTab.tsx`
  - `src/components/cart/CartTab.tsx`
  - `src/components/home/HomeTab.tsx` (ScenarioCard)
  - `src/components/ui/ProductModal.tsx`
  - `src/components/ui/StoreAvatar.tsx`
  - `src/components/stores/StoreDetailView.tsx`
  - `src/components/favorites/FavoritesTab.tsx`
