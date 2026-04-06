# План: Ограничение попыток ввода OTP кода

## Что защищаем и почему это критично

Сейчас эндпоинт `POST /auth/verify` (и `verify-code`) принимает код без ограничений.
OTP — 4 цифры = 10 000 вариантов. Без ограничения попыток злоумышленник перебирает
все варианты за секунды простым скриптом и получает доступ к любому аккаунту.

Redis выбран для хранения счётчика потому что:
- он уже есть в проекте (courier location, SSE)
- TTL встроен нативно — не нужно чистить устаревшие записи вручную
- атомарные операции INCR — безопасно при параллельных запросах
- не засоряем PostgreSQL служебными данными

---

## Шаги реализации

---

### Шаг 1 — Создать новый файл `internal/auth/otp_limiter.go`

**Почему отдельный файл, а не вставлять в service.go:**
`service.go` уже 500+ строк. Rate limiting — самостоятельная ответственность
(не бизнес-логика авторизации, а защитная инфраструктура). Отдельный файл
соответствует принципу Single Responsibility и его легко тестировать изолированно.

**Что будет внутри:**

Интерфейс `OTPLimiter` с двумя методами:
- `CheckAndIncrement(ctx, phone) (attemptsLeft int, blocked bool, err error)`
  — проверяет счётчик и атомарно увеличивает его на 1
- `Reset(ctx, phone) error`
  — сбрасывает счётчик после успешной верификации

Почему интерфейс, а не конкретная структура:
- в тестах можно подменить mock без поднятия Redis
- следует паттерну, который уже используется в проекте (SMSProvider — тоже интерфейс)

Реализация `RedisOTPLimiter` с полями:
- `rdb *redis.Client` — клиент редиса (берётся из `cache.Client().Client()`)
- `maxAttempts int` — максимум попыток (константа 5)
- `blockTTL time.Duration` — время блокировки (15 минут)

**Ключ в Redis:**
```
otp:attempts:{phone}
```
Пример: `otp:attempts:79640691596`

Выбран такой формат потому что:
- префикс `otp:attempts:` изолирует ключи от других данных в Redis
  (courier использует `geo:`, не будет конфликтов)
- номер телефона как суффикс — естественный идентификатор попытки

**Логика `CheckAndIncrement`:**
1. `INCR otp:attempts:{phone}` — атомарно увеличить счётчик
2. Если результат == 1 (первое обращение) — установить `EXPIRE` на `blockTTL`
   (почему при ==1: только в этот момент мы знаем что ключ новый и нужно поставить TTL;
   если ставить EXPIRE при каждом вызове — TTL будет сдвигаться и блокировка никогда не кончится)
3. Если результат > maxAttempts — вернуть `blocked=true`
4. Иначе вернуть `attemptsLeft = maxAttempts - result`

**Почему INCR, а не GET + SET:**
INCR — атомарная операция Redis. GET + проверка + SET — три отдельные операции,
между которыми возможен race condition при параллельных запросах с одного номера.

---

### Шаг 2 — Пробросить `OTPLimiter` в `AuthService`

**Почему именно в сервис, а не в хэндлер:**

Хэндлер отвечает за HTTP (парсинг запроса, коды ответа).
Бизнес-правило "не более 5 попыток" — это логика домена авторизации,
она должна жить в сервисе. Так же, как SMS cooldown (60 секунд) уже живёт в сервисе.

Добавить поле в структуру `AuthService`:
```
otpLimiter OTPLimiter
```

Обновить конструктор `NewAuthService` — добавить параметр `otpLimiter OTPLimiter`.
Если передан nil — использовать `NoopOTPLimiter` (всегда пропускает),
чтобы сервис работал без Redis (аналогично тому как `nil` smsProvider → NoopSMSProvider).

---

### Шаг 3 — Встроить проверку в методы `Verify` и `VerifyCode`

Оба метода занимаются верификацией OTP. Логика одна и та же.

**В начале каждого метода**, до вызова `verifyAndConsumeCode`:
1. Вызвать `otpLimiter.CheckAndIncrement(ctx, phone)`
2. Если `blocked == true` — вернуть новую ошибку `ErrOTPBlocked`
3. Если ошибка — залогировать и продолжить (graceful degradation:
   если Redis недоступен, не ломаем вход полностью)

**После успешной верификации** в `verifyAndConsumeCode`:
1. Вызвать `otpLimiter.Reset(ctx, phone)`
2. Ошибку Reset — только залогировать, не возвращать
   (пользователь уже прошёл верификацию, незачем ему показывать ошибку Redis)

---

### Шаг 4 — Добавить новую ошибку `ErrOTPBlocked`

В `service.go` рядом с существующими ошибками (`ErrInvalidRole`, `ErrCodeRequired` и т.д.)
добавить:
```
ErrOTPBlocked = errors.New("otp blocked: too many attempts")
```

Почему отдельная sentinel error, а не просто строка:
- хэндлер делает `errors.Is(err, ErrOTPBlocked)` — типобезопасно
- если потом нужно будет обработать иначе в другом месте — просто добавить case

---

### Шаг 5 — Обработать `ErrOTPBlocked` в хэндлере

В `handler.go`, в методах `Verify` и `VerifyCode`, добавить case в switch:

```
case errors.Is(err, ErrOTPBlocked):
    c.JSON(429, gin.H{
        "error": "Слишком много попыток. Попробуйте через 15 минут",
    })
```

HTTP 429 Too Many Requests — семантически правильный статус для rate limiting.
Фронт уже умеет обрабатывать 429 (SMS cooldown возвращает тот же статус).

---

### Шаг 6 — Создать `NoopOTPLimiter` для тестов и dev-режима

Реализация интерфейса `OTPLimiter` которая:
- `CheckAndIncrement` — всегда возвращает `attemptsLeft=5, blocked=false, err=nil`
- `Reset` — ничего не делает, возвращает nil

Используется когда Redis недоступен или в unit-тестах.

---

### Шаг 7 — Обновить `main.go`

Добавить создание `RedisOTPLimiter` и передачу в `NewAuthService`:
```
otpLimiter := auth.NewRedisOTPLimiter(redisClient.Client(), 5, 15*time.Minute)
authService := auth.NewAuthService(authRepo, userRepo, cfg.JWT.Secret, smsProvider, logger, otpLimiter)
```

`redisClient` уже инициализирован в `main.go` для courier — просто переиспользуем.

---

## Итоговая схема работы

```
POST /auth/verify  { phone, code }
        │
        ▼
handler.Verify
        │
        ▼
service.Verify
        │
        ├─► otpLimiter.CheckAndIncrement("79640691596")
        │         │
        │    Redis INCR otp:attempts:79640691596
        │         │
        │    счётчик 1-5 → продолжаем, возвращаем attemptsLeft
        │    счётчик > 5 → ErrOTPBlocked → 429
        │
        ▼
verifyAndConsumeCode(phone, code)
        │
    ошибка ──► вернуть ошибку (счётчик остаётся, попытка потрачена)
        │
    успех ──► otpLimiter.Reset("79640691596")
                    │
              Redis DEL otp:attempts:79640691596
                    │
              вернуть JWT токен → 200
```

---

## Что НЕ делаем и почему

**Не храним в PostgreSQL** — TTL в Postgres требует cron-job для очистки,
Redis делает это нативно и атомарно.

**Не ограничиваем по IP** — в мобильном приложении IP меняется (WiFi → мобильная сеть),
один пользователь может казаться разными IP. Номер телефона — надёжный идентификатор.

**Не добавляем middleware** — попытки OTP привязаны к номеру телефона из тела запроса,
а не к заголовкам. Middleware работает на уровне HTTP до парсинга тела,
поэтому логика должна быть в сервисе.

**Не сбрасываем счётчик при новом запросе кода** — если сбрасывать при `request-code`,
злоумышленник может бесконечно запрашивать новый код и всегда иметь 5 свежих попыток.
Счётчик должен жить независимо от того, был ли запрошен новый код.

---

## Затрагиваемые файлы

| Файл | Действие |
|------|----------|
| `internal/auth/otp_limiter.go` | Создать (новый) |
| `internal/auth/service.go` | Добавить поле + параметр в конструктор + вызовы в Verify/VerifyCode |
| `internal/auth/handler.go` | Добавить case ErrOTPBlocked в Verify и VerifyCode |
| `cmd/api/main.go` | Создать RedisOTPLimiter, передать в NewAuthService |

Итого 4 файла, все изменения локальны в пакете `auth` и точке входа.
