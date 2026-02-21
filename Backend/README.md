# Laman - Backend сервиса доставки

Production-ready MVP backend для приложения доставки, построенный на Go, следующий принципам Clean Architecture.

## Архитектура

Проект следует архитектуре **Modular Monolith** с паттернами **Clean Architecture / Hexagonal**:

```
/cmd
   /api              # Точка входа приложения
/internal
   /auth             # Модуль аутентификации
   /users            # Модуль пользователей
   /catalog          # Модуль каталога (категории, товары, магазины)
   /orders           # Модуль заказов (основная бизнес-логика)
   /payments         # Модуль оплат
   /delivery         # Модуль доставки
   /database         # Подключение к БД и утилиты
   /config           # Управление конфигурацией
   /middleware       # HTTP middleware
   /models           # Доменные модели
   /observability    # Логирование, трейсинг, метрики
/pkg                 # Публичные пакеты (если есть)
/migrations          # Миграции базы данных
/docker              # Файлы конфигурации Docker
```

### Принципы архитектуры

- **Clean Architecture**: Разделение ответственности с четкими границами
- **Dependency Injection**: Все зависимости инжектируются, нет глобального состояния
- **Interface-based Design**: Репозитории и сервисы используют интерфейсы
- **Context Propagation**: Все операции используют context.Context
- **Graceful Shutdown**: Правильная очистка при завершении приложения

## Возможности

- ✅ Аутентификация пользователей через верификацию телефона (JWT)
- ✅ Поддержка гостевых заказов
- ✅ Каталог товаров с категориями
- ✅ Управление заказами с жизненным циклом статусов
- ✅ Расчет цен (товары, сервисный сбор, стоимость доставки)
- ✅ Обработка оплат (Наличные, Перевод)
- ✅ Отслеживание доставки
- ✅ Метрики Prometheus
- ✅ Структурированное логирование (Zap)
- ✅ Распределенный трейсинг (OpenTelemetry + Jaeger)
- ✅ Контейнеризация Docker
- ✅ Миграции базы данных

## Требования

- Go 1.21 или выше
- Docker и Docker Compose
- Make (опционально, для удобных команд)

## Быстрый старт

### Использование Docker Compose (Рекомендуется)

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd Laman
```

2. Создайте файл `.env` (опционально, значения по умолчанию установлены в docker-compose.yml):
```bash
cp env.example .env
# Отредактируйте .env со своими значениями
```

3. Запустите все сервисы:
```bash
make docker-up
# или
docker-compose up -d
```

Это запустит:
- Базу данных PostgreSQL
- API сервер
- Миграции базы данных (автоматически)
- Jaeger (трейсинг)
- Prometheus (метрики)
- Grafana (дашборды)
- Admin Panel (React)

4. Доступ к сервисам:
- API: http://localhost:8080
- Admin Panel: http://localhost:5173
- Uploads (статические файлы): http://localhost:8080/uploads/<filename>
- Grafana: http://localhost:3000 (admin/admin)
- Jaeger UI: http://localhost:16686
- Prometheus: http://localhost:9090

### Локальная разработка

1. Установите зависимости:
```bash
make deps
# или
go mod download
```

2. Запустите PostgreSQL (или используйте Docker):
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=laman \
  -p 5432:5432 \
  postgres:15-alpine
```

3. Установите переменные окружения:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=laman
export JWT_SECRET=your-secret-key-change-in-production
```

4. Запустите миграции:
```bash
make migrate-up
# или вручную:
migrate -path ./migrations -database "postgres://postgres:postgres@localhost:5432/laman?sslmode=disable" up
```

5. Запустите приложение:
```bash
make run
# или
go run ./cmd/api
```

## Миграции базы данных

### Использование Make

```bash
# Запустить миграции вверх
make migrate-up

# Запустить миграции вниз
make migrate-down

# Показать текущую версию
make migrate-version

# Создать новую миграцию
make migrate-create NAME=add_new_table

# Принудительно установить версию миграции
make migrate-force VERSION=1
```

### Использование Docker

Миграции запускаются автоматически при старте сервисов с помощью `docker-compose up`.

## API Endpoints

### Аутентификация

- `POST /api/v1/auth/send-code` - Отправить код верификации
- `POST /api/v1/auth/verify-code` - Верифицировать код и получить JWT токен
- `GET /api/v1/auth/me` - Получить текущего пользователя (требует аутентификации)

### Пользователи

- `GET /api/v1/users/me` - Получить профиль текущего пользователя (требует аутентификации)
- `GET /api/v1/users/profile` - Получить профиль пользователя (требует аутентификации)
- `PUT /api/v1/users/profile` - Обновить профиль пользователя (требует аутентификации)

### Каталог

- `GET /api/v1/catalog/categories` - Получить все категории
- `GET /api/v1/catalog/products` - Получить товары (query: `category_id`, `available_only`)
- `GET /api/v1/catalog/products/:id` - Получить товар по ID

### Магазины

- `GET /api/v1/stores` - Получить магазины (query: `category_type`, `search`)
- `GET /api/v1/stores/:id` - Получить магазин по ID
- `GET /api/v1/stores/:id/products` - Товары магазина (query: `subcategory_id`, `search`)
- `GET /api/v1/stores/:id/subcategories` - Подкатегории магазина

### Заказы

- `POST /api/v1/orders` - Создать заказ (гостевой или аутентифицированный)
- `GET /api/v1/orders/:id` - Получить заказ по ID
- `GET /api/v1/orders` - Получить заказы пользователя (требует аутентификации)
- `PUT /api/v1/orders/:id/status` - Обновить статус заказа

### Health & Metrics

- `GET /health` - Проверка здоровья
- `GET /metrics` - Метрики Prometheus

### Admin API (Basic Auth)

Все маршруты админки защищены Basic Auth (`ADMIN_USER`, `ADMIN_PASSWORD`).

- `GET /api/v1/admin/dashboard/stats` - Статистика для dashboard
- `GET /api/v1/admin/orders/active` - Активные заказы (не DELIVERED)
- `POST /api/v1/admin/stores` - Создать магазин
- `DELETE /api/v1/admin/stores/:id` - Удалить магазин
- `POST /api/v1/admin/products` - Создать товар (multipart/form-data + image)
- `POST /api/v1/admin/products/import` - Массовый импорт (Excel/CSV)
- `DELETE /api/v1/admin/products/:id` - Удалить товар
- `PATCH /api/v1/admin/orders/:id` - Обновить статус заказа

## Все URL сервиса

- API: http://localhost:8080
- Admin Panel: http://localhost:5173
- Uploads: http://localhost:8080/uploads/<filename>
- Grafana: http://localhost:3000
- Jaeger: http://localhost:16686
- Prometheus: http://localhost:9090

## Примеры запросов

### 1. Отправить код верификации

```bash
curl -X POST http://localhost:8080/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79991234567"}'
```

### 2. Верифицировать код и получить токен

```bash
curl -X POST http://localhost:8080/api/v1/auth/verify-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79991234567", "code": "123456"}'
```

Ответ:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "phone": "+79991234567",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 3. Получить категории

```bash
curl http://localhost:8080/api/v1/catalog/categories
```

### 4. Получить товары

```bash
curl http://localhost:8080/api/v1/catalog/products?available_only=true
```

### 5. Создать гостевой заказ

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Иван Иванов",
    "guest_phone": "+79991234567",
    "guest_address": "ул. Ленина, д. 10, кв. 5",
    "comment": "Позвонить за час",
    "delivery_address": "ул. Ленина, д. 10, кв. 5",
    "payment_method": "CASH",
    "items": [
      {
        "product_id": "product-uuid",
        "quantity": 2
      }
    ]
  }'
```

### 6. Создать аутентифицированный заказ

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "delivery_address": "ул. Ленина, д. 10, кв. 5",
    "payment_method": "TRANSFER",
    "items": [
      {
        "product_id": "product-uuid",
        "quantity": 1
      }
    ]
  }'
```

### 7. Получить заказ

```bash
curl http://localhost:8080/api/v1/orders/order-uuid
```

### 8. Обновить статус заказа

```bash
curl -X PUT http://localhost:8080/api/v1/orders/order-uuid/status \
  -H "Content-Type: application/json" \
  -d '{"status": "CONFIRMED"}'
```

## Жизненный цикл статусов заказа

```
NEW → NEEDS_CONFIRMATION → CONFIRMED → IN_PROGRESS → DELIVERED
  ↓                           ↓              ↓
CANCELLED                  CANCELLED      CANCELLED
```

Валидные переходы состояний обеспечиваются слоем сервисов.

## Переменные окружения

| Переменная | Описание | По умолчанию |
|-----------|----------|--------------|
| `DB_HOST` | Хост базы данных | `localhost` |
| `DB_PORT` | Порт базы данных | `5432` |
| `DB_USER` | Пользователь БД | `postgres` |
| `DB_PASSWORD` | Пароль БД | `postgres` |
| `DB_NAME` | Имя БД | `laman` |
| `DB_SSLMODE` | Режим SSL | `disable` |
| `SERVER_PORT` | Порт сервера | `8080` |
| `SERVER_HOST` | Хост сервера | `0.0.0.0` |
| `JWT_SECRET` | Секретный ключ JWT | **Обязательно** |
| `JAEGER_ENDPOINT` | Эндпоинт коллектора Jaeger | `http://localhost:14268/api/traces` |

## Мониторинг и наблюдаемость

### Метрики Prometheus

Метрики доступны на эндпоинте `/metrics`:
- `http_requests_total` - Общее количество HTTP запросов
- `http_request_duration_seconds` - Гистограмма длительности запросов

### Дашборды Grafana

Доступ к Grafana по адресу http://localhost:3000 и настройте Prometheus как источник данных.

### Трейсинг Jaeger

Доступ к Jaeger UI по адресу http://localhost:16686 для просмотра распределенных трейсов.

## Тестирование

```bash
# Запустить все тесты
make test

# Запустить тесты с покрытием
make test-coverage
```

## Качество кода

```bash
# Форматировать код
make fmt

# Запустить линтер
make lint

# Запустить go vet
make vet
```

## Команды Make

```bash
make help              # Показать все доступные команды
make build             # Собрать приложение
make run               # Запустить приложение
make test              # Запустить тесты
make migrate-up        # Запустить миграции вверх
make migrate-down      # Запустить миграции вниз
make migrate-create    # Создать новую миграцию (NAME=xxx)
make docker-up         # Запустить все сервисы
make docker-down       # Остановить все сервисы
make docker-build      # Собрать docker образы
make docker-logs       # Показать логи docker
make clean             # Очистить артефакты сборки
```

## Детали структуры проекта

### Модели

Доменные модели определены в `internal/models/`:
- `user.go` - User и UserProfile
- `catalog.go` - Category, Product, Store
- `order.go` - Order, OrderItem, OrderStatus
- `payment.go` - Payment, PaymentMethod, PaymentStatus
- `delivery.go` - Delivery
- `auth.go` - AuthCode

### Репозитории

Интерфейсы репозиториев и реализации PostgreSQL:
- Каждый модуль имеет `repository.go` (интерфейс) и `postgres_repository.go` (реализация)
- Все репозитории используют `context.Context` для отмены и таймаутов
- Транзакции поддерживаются через `database.WithTx()`

### Сервисы

Бизнес-логика находится в слое сервисов:
- Сервисы зависят от интерфейсов репозиториев (инверсия зависимостей)
- Сервисы обрабатывают валидацию и бизнес-правила
- Сервисы координируют работу между несколькими репозиториями при необходимости

### Обработчики

HTTP обработчики используют фреймворк Gin:
- Обработчики валидируют запросы
- Обработчики вызывают сервисы
- Обработчики форматируют ответы
- Обработка ошибок следует единому формату: `{"error": "message"}`

## Лицензия

MIT

## Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для функции
3. Внесите изменения
4. Добавьте тесты
5. Отправьте pull request
