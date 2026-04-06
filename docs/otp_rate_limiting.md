# OTP Rate Limiting — Документация

## Что это и зачем

OTP (One-Time Password) — одноразовый код подтверждения при входе.
Без ограничения попыток — 4-значный код перебирается за секунды (10 000 вариантов).

Решение: хранить счётчик неудачных попыток в Redis.
После 5 попыток — блокировка телефона на 15 минут.

---

## Архитектура

```
POST /auth/verify { phone, code }
        │
        ▼
handler.Verify
        │
        ▼
service.Verify
        │
        ├─► otpLimiter.CheckAndIncrement(phone)
        │         │
        │    Redis INCR otp:attempts:79640691596
        │         │
        │    счётчик 1–5  → продолжаем (attemptsLeft = 5 - count)
        │    счётчик > 5  → ErrOTPBlocked → HTTP 429
        │
        ▼
verifyAndConsumeCode(phone, code)
        │
    ошибка ──► вернуть ошибку (счётчик не сбрасывается)
        │
    успех ──► otpLimiter.Reset(phone)
                    │
              Redis DEL otp:attempts:79640691596
                    │
              вернуть JWT токен → HTTP 200
```

---

## Файлы

| Файл | Роль |
|------|------|
| `internal/auth/otp_limiter.go` | Интерфейс OTPLimiter, RedisOTPLimiter, NoopOTPLimiter |
| `internal/cache/keys.go` | Константа ключа `otp:attempts:%s` |
| `internal/auth/service.go` | Вызовы CheckAndIncrement и Reset в Verify / VerifyCode |
| `internal/auth/handler.go` | Обработка ErrOTPBlocked → HTTP 429 |
| `cmd/api/main.go` | Создание RedisOTPLimiter и передача в NewAuthService |

---

## Ключ в Redis

```
otp:attempts:{phone}
```

Пример: `otp:attempts:79640691596`

Можно проверить вручную:
```bash
docker compose exec redis redis-cli GET otp:attempts:79640691596
docker compose exec redis redis-cli TTL otp:attempts:79640691596
```

---

## Параметры (main.go)

```go
auth.NewRedisOTPLimiter(redisClient.Client(), 5, 15*time.Minute)
//                                             ^    ^
//                                    maxAttempts  blockTTL
```

Чтобы изменить — поправить значения в `cmd/api/main.go`.
В будущем можно вынести в конфиг (`MAX_OTP_ATTEMPTS`, `OTP_BLOCK_TTL`).

---

## HTTP ответы

| Ситуация | Статус | Тело |
|----------|--------|------|
| Попытка 1–5, код неверный | 401 | `{"error": "неверный или истекший код..."}` |
| Попытка > 5 | 429 | `{"error": "Слишком много попыток. Попробуйте через 15 минут"}` |
| Redis недоступен | — | Блокировка не применяется, вход продолжает работать |

---

## Лучшие практики и частые ошибки

### ✅ Почему INCR, а не GET + SET

```
// НЕПРАВИЛЬНО — race condition:
val := redis.GET(key)      // горутина A читает 3
val := redis.GET(key)      // горутина B читает 3 (одновременно)
redis.SET(key, val+1)      // A пишет 4
redis.SET(key, val+1)      // B пишет 4 — один инкремент потерян!

// ПРАВИЛЬНО — атомарно:
redis.INCR(key)            // атомарная операция, результат всегда корректен
```

### ✅ Почему TTL только при count == 1

```
// НЕПРАВИЛЬНО — sliding window:
// Злоумышленник делает попытку каждые 14:59 минут.
// TTL сдвигается, счётчик никогда не достигает максимума.
if err := redis.Expire(key, ttl); err != nil { ... }  // при каждом INCR

// ПРАВИЛЬНО — фиксированное окно:
// TTL ставится один раз при создании ключа. Не сдвигается.
if count == 1 {
    redis.Expire(key, ttl)
}
```

### ✅ Почему сначала лимит, потом проверка кода

```
// НЕПРАВИЛЬНО:
// 1. Проверить код → успех
// 2. Проверить лимит → заблокировать
// Злоумышленник на 6-й попытке угадал верный код — получил успех до блокировки.

// ПРАВИЛЬНО:
// 1. Проверить лимит → если blocked → 429, стоп
// 2. Проверить код
```

### ✅ Почему Reset только при успехе

```
// НЕПРАВИЛЬНО:
// Reset вызывается при любом исходе → злоумышленник может вечно пробовать

// ПРАВИЛЬНО:
// Reset только после verifyAndConsumeCode без ошибки
```

### ✅ Graceful degradation при падении Redis

```
// НЕПРАВИЛЬНО:
if err != nil {
    return 0, true, nil  // Redis упал → блокируем ВСЕХ пользователей
}

// ПРАВИЛЬНО:
if err != nil {
    logger.Warn("OTPLimiter недоступен")
    // продолжаем без ограничений — лучше пропустить атаку,
    // чем заблокировать всех реальных пользователей
}
```

### ✅ Паттерн Null Object (NoopOTPLimiter)

```go
// НЕПРАВИЛЬНО — проверка nil везде в коде:
if s.otpLimiter != nil {
    _, blocked, err := s.otpLimiter.CheckAndIncrement(ctx, phone)
    ...
}

// ПРАВИЛЬНО — Null Object:
// В конструкторе: if otpLimiter == nil { otpLimiter = NewNoopOTPLimiter() }
// В коде: просто вызываем, NoopOTPLimiter вернёт "всё ок"
_, blocked, err := s.otpLimiter.CheckAndIncrement(ctx, phone)
```

---

## Как это сделано в крупных компаниях

**Twilio Verify:**
- Redis INCR + TTL (фиксированное окно)
- 5 попыток, блокировка 10 минут
- Отдельный endpoint для проверки статуса блокировки

**GitHub API:**
- Redis + sliding window (скользящее окно — сложнее, но точнее)
- Возвращает заголовки `X-RateLimit-Remaining` и `X-RateLimit-Reset`

**Stripe:**
- Многоуровневый rate limiting: per-IP + per-account
- При превышении: exponential backoff (задержка растёт при каждой попытке)

**AWS Cognito:**
- Фиксированное окно, 5 попыток
- После блокировки — новый код нужно запрашивать заново

**Наша реализация** соответствует подходу Twilio / AWS Cognito —
фиксированное окно, Redis INCR, graceful degradation.

---

## Что можно улучшить в будущем

1. **Заголовки `X-RateLimit-*`** — вернуть клиенту сколько попыток осталось
   ```
   X-RateLimit-Limit: 5
   X-RateLimit-Remaining: 2
   X-RateLimit-Reset: 1712345678
   ```

2. **Вынести параметры в конфиг** — `MAX_OTP_ATTEMPTS=5`, `OTP_BLOCK_TTL=15m`

3. **Блокировка по IP** — дополнительный слой защиты для одного IP

4. **Exponential backoff** — после каждой блокировки следующая длиннее:
   15мин → 1час → 24часа

5. **Алерт в Telegram** — если с одного номера идёт серия блокировок
