
# Laman — сервис доставки

## О проекте
Стартап универсальной доставки в Грозном (400к население).
Сервис доставки "чего угодно" — продукты, еда, товары из магазинов.

## Репозитории
- GitHub: git@github.com:kurojiinn/Laman-App.git (origin)
- GitLab: git@gitlab.com:Khadzhiev404/laman-backend.git (gitlab)

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
│   │   ├── courier/            — локация курьеров, смены, GEO поиск в Redis
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
├── Frontend/
│   ├── client-app/             ← Next.js 16 (клиентское приложение, port 3000)
│   │   ├── src/app/            — App Router страницы (каталог, корзина, заказы, профиль)
│   │   ├── src/components/     — React компоненты
│   │   ├── src/context/        — Auth, Cart, Favorites контексты
│   │   ├── src/lib/            — API клиент
│   │   └── next.config.ts      — минимальная конфигурация (НЕТ прокси)
│   │   ⚠️ НЕТ Dockerfile — запускается только через npm run dev
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
├── UI/                         ← iOS приложение (SwiftUI, MVVM)
│   ├── Services/LamanAPI.swift — API вызовы к бэкенду
│   └── ...                     — ViewModels, Models, Views
│
├── docker-compose.yml          ← Основной способ запуска (8 сервисов)
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

### client-app (Next.js) — ТОЛЬКО npm run dev
```bash
# client-app нет в docker-compose и нет Dockerfile!
cd Frontend/client-app
npm install
npm run dev        # http://localhost:3000
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

| Сервис       | Образ / Dockerfile              | Port  | Зависит от               |
|--------------|--------------------------------|-------|--------------------------|
| postgres     | postgres:15-alpine             | 5432  | —                        |
| redis        | redis:7-alpine                 | 6379  | —                        |
| jaeger       | jaegertracing/all-in-one       | 16686 | —                        |
| prometheus   | prom/prometheus                | 9090  | —                        |
| grafana      | grafana/grafana                | 3000  | —                        |
| api          | ./Backend/Dockerfile           | 8080  | postgres, redis, jaeger  |
| admin-panel  | ./Frontend/admin-panel/Dockerfile | 5173 | api                   |
| picker-panel | ./Frontend/picker-panel/Dockerfile | 5174 | api                  |

Конфиг: `.env` файл в корне, `HOST_IP=192.168.0.104` — IP машины в локальной сети.
Фронтенды обращаются к API по `http://${HOST_IP}:8080`.

---

## Технический стек

- **Backend**: Go + Gin framework
- **iOS**: SwiftUI + MVVM
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
- **CLIENT** — клиент, делает заказ через iOS или web
- **COURIER** — курьер, доставляет заказ
- **PICKER** — сборщик в магазине, собирает заказ
- **ADMIN** — администратор системы

Все роли хранятся в таблице `users` с полем `role`.

---

## Ключевые модели

```go
User    { ID, Phone, Role, StoreID, PasswordHash, CreatedAt, UpdatedAt }
Order   { ID, UserID, CourierID, PickerID, StoreID, Status, PaymentMethod,
          ItemsTotal, ServiceFee, DeliveryFee, FinalTotal, ... }
Store   { ID, Name, Lat, Lng, ... }
Product { ID, StoreID, Name, Price, ImageURL, ... }
OrderItem { ID, OrderID, ProductID, Quantity, Price }
```

---

## Статусы заказа

```
NEW → ACCEPTED_BY_PICKER → ASSEMBLING → ASSEMBLED → WAITING_COURIER → COURIER_PICKED_UP → DELIVERING → DELIVERED
                         ↘ NEEDS_CONFIRMATION ↗
Любой статус → CANCELLED (кроме DELIVERED)
```

---

## API эндпоинты (base: http://HOST_IP:8080)

### Auth
```
POST /api/v1/auth/request-code
POST /api/v1/auth/verify-code
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### Orders
```
POST /api/v1/orders
GET  /api/v1/orders/:id
GET  /api/v1/orders
PUT  /api/v1/orders/:id/status
```

### Picker
```
POST /api/v1/picker/auth/login          — логин (phone + password)
GET  /api/v1/picker                     — список заказов магазина (без items!)
GET  /api/v1/picker/orders/:id          — конкретный заказ (с items + image_url)
PUT  /api/v1/picker/orders/:id/status   — обновить статус
GET  /api/v1/picker/events              — SSE поток уведомлений
```

### Courier
```
POST /api/v1/courier/location
GET  /api/v1/courier/location/:courierId
POST /api/v1/courier/shift/start
POST /api/v1/courier/shift/end
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
- OTP авторизация через SMS.RU
- JWT токены
- Каталог товаров и магазинов
- Создание заказов (гостевые + авторизованные)
- Трекинг локации курьеров через Redis GEO
- Смены курьеров
- Поиск ближайшего курьера (5км → 10км → уведомление админу)
- Telegram уведомления
- Observability: трейсинг, метрики, логирование
- CI/CD GitLab pipeline
- Панель сборщика — бэкенд + фронт (picker-panel)
- SSE уведомления для сборщика

## Что в разработке
- TASK-009: Push уведомления клиенту
- TASK-010: Онлайн оплата (ЮKassa)
- TASK-011: Промокоды и скидки
- TASK-012: Рейтинг магазинов
- TASK-013: Регистрация магазинов
- TASK-014: Интеграция курьерской службы

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
- picker-panel и admin-panel Docker образы запускают `npm run dev` (не prod!)
  → при изменении кода нужно пересобирать образ: `docker-compose build <service>`
  → для активной разработки лучше запускать `npm run dev` локально
