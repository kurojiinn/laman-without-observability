# CHANGELOG v1.2.0

Дата: 2026-02-22

## Что изменено

### 1) Исправления UI-проекта (Xcode)
- Исправлена конфигурация `LamanDelivery.xcodeproj`:
- В `Build Phases -> Sources` подключены все Swift-файлы проекта.
- Удалена самоссылка `LamanDelivery.xcodeproj` внутри `project.pbxproj`, которая могла вызывать битые `lstat`-ошибки.
- Проверка: `xcodebuild ... build` завершился `BUILD SUCCEEDED`.

### 2) Миграции Backend переведены в единый формат (up/down в одном файле)
- Все split-миграции `*.up.sql`/`*.down.sql` объединены в единые `*.sql` с блоками:
- `-- +goose Up`
- `-- +goose Down`
- Переведены файлы:
- `000001_init_schema.sql`
- `000002_seed_data.sql`
- `000003_add_subcategories_and_payment_method.sql`
- `000004_marketplace_stores.sql`
- `000005_add_pharmacy_store_type.sql`
- `000006_seed_pharmacy_store.sql`
- `000007_add_product_image_url.sql`
- Обновлён `Makefile`: миграционные команды переведены с `migrate` на `goose`.
- Обновлён `README.md`: команды миграций и примеры синхронизированы с `goose`.
- Проверка: `goose -dir ./migrations validate` проходит без ошибок.

### 3) Добавлена регистрация с выбором роли (`CLIENT`/`COURIER`)
- Новый endpoint:
- `POST /api/v1/auth/register`
- Новый формат регистрации:
- `register (phone, role)` -> JWT.
- `verify-code` теперь используется как вход только для уже зарегистрированных пользователей.
- Добавлена валидация ролей на уровне модели:
- `UserRoleClient`, `UserRoleCourier`, `IsValidUserRole`.
- Добавлены доменные ошибки:
- `ErrInvalidRole`
- `ErrUserAlreadyExists`
- `ErrRegistrationRequired`

### 4) Наблюдаемость (метрики, логи, трейсинг) для auth-регистрации
- Добавлены Prometheus-метрики в `internal/auth/metrics.go`:
- `auth_operation_total{operation,result}`
- `auth_operation_duration_seconds{operation}`
- Добавлен трейсинг в `auth` сервисе через `observability.StartSpan(...)`:
- `auth.SendCode`
- `auth.Register`
- `auth.VerifyCode`
- `auth.verifyAndConsumeCode`
- Добавлены структурные логи (`zap`) в handler/service:
- ошибки валидации входа,
- результат регистрации,
- попытка входа без регистрации,
- успешная аутентификация.

### 5) Обновления кода и документации
- `auth` handler расширен новым маршрутом `/auth/register`.
- `README.md` обновлён:
- добавлен endpoint регистрации,
- добавлены примеры `curl` для регистрации и логина,
- в примерах ответа пользователя добавлено поле `role`.
- В изменённых файлах добавлены/сохранены комментарии над функциями и ключевыми сущностями.

### 6) Реализована UI-интеграция регистрации (SwiftUI, MVVM)
- Добавлена модель auth-состояния и `AuthViewModel`:
- состояния `.idle`, `.loading`, `.success`, `.error`.
- сохранение токена и пользователя в `UserDefaults` (MVP).
- Добавлен API-метод регистрации через `URLSession`:
- `POST /api/v1/auth/register` с `phone` + `role`.
- На главном экране (`CatalogView`) добавлена иконка профиля `person.circle` под поиском.
- При нажатии:
- неавторизованный пользователь попадает в `RegistrationView`;
- авторизованный пользователь попадает в `ProfileView`.
- В `RegistrationView` реализованы:
- ввод телефона,
- `Picker` (segmented) выбора роли `Клиент/Курьер`,
- обработка состояний загрузки/успеха/ошибки.
- В `ProfileView` реализована role-based заглушка:
- для курьера: `Интерфейс курьера`;
- для клиента: `Интерфейс клиента`.

## Изменённые файлы (ключевые)
- `cmd/api/main.go`
- `internal/auth/handler.go`
- `internal/auth/service.go`
- `internal/auth/metrics.go`
- `internal/models/user.go`
- `internal/users/postgres_repository.go`
- `migrations/*.sql` (конвертация в единый goose-формат)
- `Makefile`
- `README.md`

## Примечания по совместимости
- После перехода на `goose` в локальной среде требуется установленный `goose`.
- Для Docker-сервиса `migrate` в `docker-compose.yml` при необходимости нужно выполнить отдельную миграцию контейнера на `goose`-образ/команду.
