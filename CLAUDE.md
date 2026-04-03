
# Laman — сервис доставки

## О проекте
Стартап универсальной доставки в Грозном (400к население).
Сервис доставки "чего угодно" — продукты, еда, товары из магазинов.

## Репозитории
- GitHub: git@github.com:kurojiinn/Laman-App.git (origin)
- GitLab: git@gitlab.com:Khadzhiev404/laman-backend.git (gitlab)

## Структура проекта
```
Laman-App/
Backend/          ← Go бэкенд
UI/               ← iOS приложение (SwiftUI)
.gitlab-ci.yml    ← CI/CD pipeline
```

## Технический стек
- Backend: Go (Gin framework)
- iOS: SwiftUI
- БД: PostgreSQL 15
- Кэш: Redis 7
- Миграции: Goose
- Трейсинг: Jaeger + OpenTelemetry
- Метрики: Prometheus + Grafana
- Логирование: Zap
- Инфраструктура: Kubernetes (Docker Desktop)
- CI/CD: GitLab CI
- JWT авторизация: golang-jwt
- Линтер: golangci-lint

## Структура бэкенда
```
Backend/
cmd/api/main.go
internal/
auth/          — OTP SMS + JWT авторизация
users/         — профиль пользователя
catalog/       — категории, подкатегории, товары, магазины
orders/        — создание и управление заказами
courier/       — локация курьеров, смены, GEO поиск в Redis
picker/        — панель сборщика
admin/         — административная панель
models/        — общие модели
middleware/    — Auth, Logging, Metrics, CORS, Recovery
observability/ — Jaeger трейсинг, Telegram уведомления
events/        — SSE Hub для real-time уведомлений
cache/         — Redis клиент
config/        — конфигурация через env переменные
delivery/      — доставка
payments/      — оплата
migrations/      — SQL миграции (Goose)
k8s/             — Kubernetes манифесты
```

## Роли в системе
- CLIENT — клиент который делает заказ через iOS приложение
- COURIER — курьер который доставляет заказ
- PICKER — сборщик в магазине который собирает заказ
- ADMIN — администратор системы

Все роли хранятся в таблице users с полем role.

## Ключевые модели
```go
User { ID, Phone, Role, StoreID, PasswordHash, CreatedAt, UpdatedAt }
Order { ID, UserID, CourierID, PickerID, StoreID, Status, PaymentMethod, ItemsTotal, ServiceFee, DeliveryFee, FinalTotal, ... }
Store { ID, Name, Lat, Lng, ... }
Product { ID, StoreID, Name, Price, ImageURL, ... }
OrderItem { ID, OrderID, ProductID, Quantity, Price }
```

## Статусы заказа
```
NEW → ACCEPTED_BY_PICKER → ASSEMBLING → ASSEMBLED → WAITING_COURIER → COURIER_PICKED_UP → DELIVERING → DELIVERED
                         ↘ NEEDS_CONFIRMATION ↗
Любой статус → CANCELLED (кроме DELIVERED)
```

## API эндпоинты

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
POST /api/v1/picker/auth/login     — логин сборщика (phone + password)
GET  /api/v1/picker/orders         — список заказов магазина
GET  /api/v1/picker/orders/:id     — конкретный заказ
PUT  /api/v1/picker/orders/:id/status — обновить статус
GET  /api/v1/picker/events         — SSE поток уведомлений
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

## Kubernetes
- Namespace: laman-dev (разработка), laman-staging (staging)
- Ingress: nginx, все запросы через localhost:80
- Сервисы: laman-api, postgres, redis, jaeger
- secrets.yaml — не в git, применяется вручную через kubectl apply

## CI/CD (GitLab)
```
lint → build → deploy_staging (auto) → deploy_prod (manual)
```
- Runner: локальный shell runner, тег local
- Registry: registry.gitlab.com/khadzhiev404/laman-backend

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
- Ingress nginx
- CI/CD GitLab pipeline
- Панель сборщика — бэкенд (TASK-008)
- SSE уведомления для сборщика

## Что в разработке
- TASK-008: Фронтенд панели сборщика (React)
- TASK-009: Push уведомления клиенту
- TASK-010: Онлайн оплата (ЮKassa)
- TASK-011: Промокоды и скидки
- TASK-012: Рейтинг магазинов
- TASK-013: Регистрация магазинов
- TASK-014: Интеграция курьерской службы

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

## Важные заметки
- secrets.yaml никогда не коммитить в git
- Всегда используй %w при оборачивании ошибок в Go
- Линтер запускать перед каждым коммитом: golangci-lint run ./...
- Миграции применяются через goose с port-forward к postgres в k8s
- GitLab runner должен быть запущен: brew services start gitlab-runner
