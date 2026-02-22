# CHANGELOG: OTP Authentication (Go Backend + SwiftUI)

Дата: 2026-02-22

## Что реализовано

Реализована двухэтапная авторизация (OTP) с интеграцией SMS.RU для backend (Go + PostgreSQL) и обновленным auth-flow в iOS (SwiftUI, MVVM).

## Backend (Go)

### 1) Конфигурация SMS.RU
- Добавлен раздел SMS в конфиг:
  - `Backend/internal/config/config.go`
  - Новая структура `SMSConfig` с полем `RuAPIKey`.
  - Загрузка `SMSRU_API_KEY` из переменных окружения.
- Обновлен пример env:
  - `Backend/env.example`
  - Добавлен ключ `SMSRU_API_KEY`.

### 2) OTP + SMS провайдер
- Добавлен новый файл:
  - `Backend/internal/auth/sms_provider.go`
- Реализовано:
  - `SMSProvider` интерфейс.
  - `SMSRUProvider` с использованием стандартного `http.Client`.
  - POST-запрос в `https://sms.ru/sms/send`.
  - `NoopSMSProvider` для локальной разработки (если API ключ не задан).

### 3) Бизнес-логика аутентификации
- Обновлен:
  - `Backend/internal/auth/service.go`
- Добавлено:
  - `RequestCodeRequest` и `VerifyRequest`.
  - `ErrRoleRequired`.
  - `RequestCode(ctx, req)`:
    - Генерация 4-значного OTP.
    - Сохранение в `auth_codes` с TTL 5 минут.
    - Отправка кода через `smsProvider`.
  - `Verify(ctx, req)`:
    - Проверка OTP.
    - Если пользователь существует: выдача JWT.
    - Если не существует: создание пользователя с `role` (`CLIENT`/`COURIER`) и выдача JWT.
- Добавлена интеграция метрик/логов/трейсинга для OTP-операций через существующие механизмы сервиса (`observability`, `zap`, prometheus-метрики auth).

### 4) HTTP эндпоинты
- Обновлен:
  - `Backend/internal/auth/handler.go`
- Добавлены роуты:
  - `POST /api/v1/auth/request-code`
  - `POST /api/v1/auth/verify`
- Реализована обработка ошибок роли (`ErrInvalidRole`, `ErrRoleRequired`) и соответствующие HTTP-ответы.

### 5) Инициализация в main
- Обновлен:
  - `Backend/cmd/api/main.go`
- Подключение SMS-провайдера:
  - `smsProvider := auth.NewSMSRUProvider(cfg.SMS.RuAPIKey)`
  - Передача в `NewAuthService(...)`.

### 6) База данных
- Таблица `auth_codes` уже присутствует в схеме:
  - `Backend/migrations/000001_init_schema.sql`
- Используется существующий репозиторий auth-кодов:
  - `Backend/internal/auth/postgres_repository.go`

## iOS (SwiftUI)

### 1) API клиент
- Обновлен:
  - `UI/Services/LamanAPI.swift`
- Добавлены методы:
  - `requestCode(phone:)` -> `POST /api/v1/auth/request-code`
  - `verify(phone:code:role:)` -> `POST /api/v1/auth/verify`
- Добавлено диагностическое логирование запроса/ответа (URL + JSON payload + статус).

### 2) ViewModel (MVVM)
- Обновлен:
  - `UI/ContentView.swift` (`AuthViewModel`)
- Добавлена OTP-логика:
  - Состояния шага подтверждения: `isAwaitingCode`, `secondsUntilResend`.
  - Сохранение контекста между шагами: `pendingPhone`, `pendingRole`, `pendingIntent`.
  - Методы:
    - `requestCode(phone:role:intent:)`
    - `verifyCode(_:)`
    - `resendCode()`
    - `resetOTPFlow()`
    - `startCountdown(seconds:)`
- Сохранение JWT в Keychain и восстановление сессии при старте сохранено.

### 3) Экран авторизации
- Обновлен:
  - `UI/ProfileView.swift` (`AuthView`)
- Реализовано:
  - Два режима: регистрация/вход.
  - После отправки номера переход на шаг ввода OTP.
  - Поле для 4 цифр, кнопка подтверждения, таймер 60 секунд и повторная отправка.
  - Центрирование текста кнопки-ссылки переключения режима:
    - `.frame(maxWidth: .infinity, alignment: .center)`
  - Очистка номера при переключении между режимами.
  - Обновлен UI текста ролей:
    - Заголовок: `Тип аккаунта`
    - Опции: `Стать клиентом` / `Стать курьером`

### 4) Header главного экрана
- Обновлен:
  - `UI/CatalogView.swift`
- Убрана верхняя надпись `Каталог` из header (как было запрошено).

## Проверка

### Backend
- Запуск:
  - `cd Backend && go test ./...`
- Результат:
  - Все пакеты успешно проходят (без ошибок).

### iOS
- Запуск:
  - `cd UI && xcodebuild -project LamanDelivery.xcodeproj -scheme LamanDelivery -sdk iphonesimulator -configuration Debug build`
- Результат:
  - `BUILD SUCCEEDED`.

## Что важно настроить перед продом
- Установить `SMSRU_API_KEY` в окружение backend.
- Для локальной разработки без ключа используется `NoopSMSProvider` (код выводится в лог).
- Убедиться, что `baseURL` в iOS указывает на доступный backend (не `localhost` при запуске на реальном устройстве).

## Дополнение: правки от 2026-02-22 (навигация OTP, формат телефона, SMS.RU URL)

### UI / SwiftUI
- Файл: `UI/ProfileView.swift`
- Добавлено:
  - Кнопка `Назад` в `navigation toolbar` на экране ввода OTP.
  - Кнопка `Изменить номер телефона` под OTP-формой.
  - При возврате к первому шагу очищаются `phone` и `otpCode`, а OTP-flow сбрасывается через `resetOTPFlow()`.
  - Поле телефона ограничено только цифрами (`numberPad` + фильтрация ввода).
  - Центрирование заголовка `Код подтверждения` (кастомный header секции) и поля `0000`.
  - Кнопка `Отправить код повторно` теперь всегда видима, синего цвета и неактивна во время таймера (60 сек).

### Формат номера перед отправкой на backend
- Файл: `UI/ContentView.swift` (`AuthViewModel`)
- Добавлено:
  - Нормализация номера перед `/request-code`:
    - удаление пробелов,
    - если номер начинается с `+7`, убирается `+`,
    - в запрос отправляются только цифры.
  - Нормализованный номер сохраняется как `pendingPhone` для шага `/verify`.

### Backend / SMS.RU
- Файл: `Backend/internal/auth/sms_provider.go`
- Добавлено/изменено:
  - Константа `const SMS_RU_KEY = "ТВОЙ_КЛЮЧ_ИЗ_SMS_RU"`.
  - Отправка SMS переведена на формат URL-параметров:
    - `https://sms.ru/sms/send?api_id=...&to=...&msg=...&json=1`
  - Вызов отправки сделан через стандартный `http.Client` (`GET` запрос).
  - Логика `RequestCode` остается прежней: сначала код сохраняется в БД, затем отправляется в SMS.RU.

### Валидация изменений
- `Backend`: `go test ./...` — успешно.
- `UI`: `xcodebuild ... build` — `BUILD SUCCEEDED`.

## Дополнение: правки по ТЗ "Авторизация по СМС" (2026-02-22)

### Backend (Go)
- Добавлена поддержка ключа из переменной `SMS_RU_KEY` (с fallback на `SMSRU_API_KEY`) в:
  - `Backend/internal/config/config.go`
- В `Backend/internal/auth/sms_provider.go`:
  - Добавлена константа `SMS_RU_KEY`.
  - Реализована очистка номера до цифр перед отправкой в SMS.RU.
  - Вызов SMS.RU через URL формата:
    - `https://sms.ru/sms/send?api_id=...&to=...&msg=...&json=1`
  - Добавлено консольное логирование:
    - исходящий запрос (`fmt.Printf`),
    - ответ SMS.RU (`status` + `body` через `fmt.Printf`).
- В `Backend/internal/auth/service.go`:
  - Добавлена очистка номера до цифр в `RequestCode` и `Verify`.
  - В БД `auth_codes` и в user lookup/create используется уже очищенный номер.
  - Последовательность сохранена: сначала запись OTP в БД (5 минут), потом отправка SMS.

### Frontend (SwiftUI)
- В `UI/ProfileView.swift`:
  - Автоподтверждение OTP при вводе 4-й цифры (`verifyCode` вызывается автоматически).
  - Кнопка `Назад` и `Изменить номер телефона` возвращают к экрану ввода номера с очисткой полей.
  - Поле номера и OTP фильтруют ввод только до цифр.
  - `Отправить код повторно` синяя и недоступна до истечения таймера 60 сек.
- `Catalog` заголовок сверху отсутствует (оставлена панель с нужными кнопками).

### Конфигурация
- Обновлен шаблон:
  - `Backend/env.example` (`SMS_RU_KEY`, `SMSRU_API_KEY` без значений по умолчанию).

### Проверка
- `cd Backend && go test ./...` — успешно.
- `cd UI && xcodebuild -project LamanDelivery.xcodeproj -scheme LamanDelivery -sdk iphonesimulator -configuration Debug build` — `BUILD SUCCEEDED`.
