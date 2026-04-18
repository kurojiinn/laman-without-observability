# Security Audit — Laman App

Дата аудита: 2026-04-17

---

## Статус по всем пунктам

### КРИТИЧЕСКИЕ

| # | Проблема | Статус | Где исправлено |
|---|----------|--------|----------------|
| 1 | `.env` с секретами в git-истории (коммит `76dd13a`) | ⚠️ ЧАСТИЧНО | `.env` добавлен в `.gitignore`, но история не почищена |
| 1a | Ротация секретов (TG_BOT_TOKEN, SMS_RU_KEY) | ❌ НЕ СДЕЛАНО | Требует ручного действия в Telegram/SMS.RU |
| 1b | Очистка git-истории (git filter-repo / BFG) | ❌ НЕ СДЕЛАНО | Требует ручного действия + force push |
| 1c | `.env.example` без значений | ✅ ГОТОВО | `.env.example` создан в корне |
| 2 | Дефолтные admin/admin credentials | ✅ ГОТОВО | `Backend/internal/config/config.go` — fallback убран, валидация при старте |
| 3 | Admin password в localStorage (plaintext) | ✅ ГОТОВО | `Frontend/admin-panel/src/App.tsx` — localStorage → sessionStorage |
| 4 | JWT токен клиента в localStorage | ✅ ГОТОВО | httpOnly cookie (backend) + in-memory tokenStore (client-app) |

### ВЫСОКИЕ

| # | Проблема | Статус | Где исправлено |
|---|----------|--------|----------------|
| 5 | `/metrics` и `/debug/pprof` без авторизации | ✅ ГОТОВО | `Backend/cmd/api/main.go` — AdminAuthMiddleware |
| 6 | CORS wildcard `*` | ✅ ГОТОВО | `Backend/internal/middleware/cors.go` — только whitelist |
| 7 | JWT в query-параметре для SSE (`?token=`) | ✅ ГОТОВО | `Frontend/client-app/src/context/OrderNotificationContext.tsx` — withCredentials |
| 8 | Нет rate limiting на `/auth/login` | ✅ ГОТОВО | `Backend/internal/auth/service.go` — loginLimiter (5 попыток / 30 мин) |
| 9 | Нет HTTP security headers | ✅ ГОТОВО | `Backend/internal/middleware/security_headers.go` (новый файл) |
| 10 | Курьер может запросить локацию другого курьера | ⏭️ ПРОПУЩЕНО | Курьерская логика переписывается, отложено |

### СРЕДНИЕ

| # | Проблема | Статус | Где исправлено |
|---|----------|--------|----------------|
| 11 | Нет HTTPS в docker-compose | ✅ ГОТОВО | `nginx/nginx.conf` + `docker-compose.yml` — nginx TLS proxy |
| 12 | Нет аудит-лога для admin действий | ❌ НЕ СДЕЛАНО | `Backend/internal/admin/handler.go` |
| 13 | Нет rate limiting на создание заказов | ❌ НЕ СДЕЛАНО | `Backend/internal/orders/handler.go` |
| 14 | Телефон не валидируется по длине | ✅ ГОТОВО | `Backend/internal/auth/service.go` — normalizePhone + проверка длины |
| 15 | Нет resource limits в контейнерах | ✅ ГОТОВО | `docker-compose.yml` — deploy.resources |
| 16 | `err.Error()` с внутренними деталями отдаётся клиенту | ✅ ГОТОВО | `Backend/internal/admin/handler.go` — respondError логирует, не раскрывает |
| 17 | `uploads/` создаётся с правами 0755 (world-readable) | ✅ ГОТОВО | `Backend/internal/admin/handler.go` — os.MkdirAll 0o750 |

### НИЗКИЕ

| # | Проблема | Статус |
|---|----------|--------|
| — | Нет сетевой сегментации в docker-compose | ❌ НЕ СДЕЛАНО |
| — | Нет CSRF токенов | ❌ НЕ СДЕЛАНО |
| — | Нет SRI для внешних зависимостей | ❌ НЕ СДЕЛАНО |

---

## Блокеры перед продом

1. **Ротация секретов** — TG_BOT_TOKEN и SMS_RU_KEY скомпрометированы (были в git). Сменить вручную.
2. **Очистка git-истории** — `git filter-repo --path .env --invert-paths`, затем force push.
3. **Создать `.env.example`** — шаблон без значений для новых разработчиков.

---

## Готовность к проду

| Область | Готовность |
|---------|-----------|
| Auth (JWT, cookies, rate limiting) | ✅ 90% |
| Admin security | ✅ 85% |
| HTTPS/TLS | ✅ 80% (самоподписанный, нужен Let's Encrypt в проде) |
| Секреты | ❌ 20% (история не почищена, токены не сменены) |
| Observability protection | ✅ 95% |
| Input validation | ✅ 80% |
| Error handling | ✅ 85% |

**Итог: ~70% готов к проду. Главный блокер — git-история с секретами.**
