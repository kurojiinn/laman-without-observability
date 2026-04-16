# Security Fixes — Laman Backend

Документация по исправлениям безопасности и качества кода.
Основана на аудите от 13 апреля 2026 (`audit-report.html`).

---

## Исправление 1 — OTP не попадает в логи в production

**Файл:** `Backend/internal/auth/service.go`  
**Приоритет:** Critical  
**Проблема:** OTP-код выводился через `fmt.Printf` и `zap.Logger` при каждой отправке.
Любой с доступом к логам мог войти в любой аккаунт.

### Что изменили

В структуру `AuthService` добавили поле `devMode bool`.
При создании сервиса передаётся флаг из конфига (`cfg.SMS.TestMode`).

```go
type AuthService struct {
    ...
    devMode bool
}
```

В методе `RequestCode` код теперь логируется только если `devMode == true`:

```go
if s.devMode {
    fields = append(fields, zap.String("dev_otp", code))
}
s.logger.Info("OTP код отправлен пользователю", fields...)
```

### Как управлять

В `.env` для локальной разработки:
```
SMS_RU_TEST=true   # OTP видно в логах
```

В production:
```
SMS_RU_TEST=false  # OTP не попадает в логи
```

### Почему так

Вместо того чтобы убирать вывод совсем (неудобно при разработке),
мы сделали его управляемым через конфиг. Это стандартный паттерн:
поведение, которое нужно только в dev-окружении, скрывается за флагом,
а не за `#ifdef` или закомментированным кодом.

### Совет

Никогда не логируй секреты, токены, пароли и одноразовые коды напрямую —
даже в dev. Используй явный флаг `devMode` или уровень логирования `DEBUG`,
который отключается в production через `LOG_LEVEL=info`.

---

## Исправление 2 — Роль пользователя в JWT токене

**Файлы:** `Backend/internal/auth/service.go`, `Backend/internal/picker/service.go`  
**Приоритет:** Critical (основа для RBAC)  
**Проблема:** JWT содержал только `user_id`. Для проверки роли нужен запрос в БД на каждый запрос,
или роль вообще не проверялась.

### Что изменили

`generateToken` теперь принимает роль и кладёт её в claims:

```go
// Было
func (s *AuthService) generateToken(userID uuid.UUID) (string, error)

// Стало
func (s *AuthService) generateToken(userID uuid.UUID, role string) (string, error) {
    claims := jwt.MapClaims{
        "user_id": userID.String(),
        "role":    role,           // ← добавили
        "exp":     ...,
        "iat":     ...,
    }
}
```

`ValidateToken` теперь возвращает роль третьим значением:

```go
// Было
func (s *AuthService) ValidateToken(token string) (uuid.UUID, error)

// Стало
func (s *AuthService) ValidateToken(token string) (uuid.UUID, string, error)
```

`AuthMiddleware` устанавливает роль в контекст запроса:

```go
userID, role, err := authService.ValidateToken(token)
c.Set("user_id", userID)
c.Set("user_role", role)  // ← теперь доступно в любом handler-е
```

### Почему так

JWT (JSON Web Token) — это подписанный токен. Данные внутри нельзя подделать
без знания `JWT_SECRET`. Поэтому роль безопасно хранить прямо в токене —
это избавляет от обращения к БД на каждый запрос для проверки кто звонит.

### На что обратить внимание

После этого изменения старые токены (без поля `role`) перестанут давать роль.
Пользователям придётся перелогиниться. В production это нужно учитывать
и делать плавный переход (grace period или одновременный деплой с ротацией токенов).

### Совет

В JWT claims клади только то, что меняется редко и нужно на каждый запрос:
`user_id`, `role`. Не клади туда `email`, `name`, права — они могут измениться,
а токен живёт 24 часа. Для часто меняющихся данных — ходи в БД.

---

## Исправление 3 — RBAC: проверка роли на эндпоинтах

**Файлы:**
- `Backend/internal/middleware/role.go` (новый файл)
- `Backend/internal/orders/handler.go`
- `Backend/internal/courier/handler.go`
- `Backend/internal/picker/handler.go`

**Приоритет:** Critical  
**Проблема:**
- `PUT /orders/:id/status` — любой залогиненный мог менять статус любого заказа
- `/courier/*` — любой мог пушить фейковую геолокацию
- `/picker/*` — любой с токеном мог работать с заказами как сборщик

### Что изменили

Создан новый middleware `RoleRequired`:

```go
// middleware/role.go
func RoleRequired(allowedRoles ...string) gin.HandlerFunc {
    allowed := make(map[string]struct{}, len(allowedRoles))
    for _, r := range allowedRoles {
        allowed[r] = struct{}{}
    }
    return func(c *gin.Context) {
        role, _ := c.Get("user_role")
        if _, ok := allowed[role.(string)]; !ok {
            c.AbortWithStatusJSON(403, gin.H{"error": "доступ запрещён"})
            return
        }
        c.Next()
    }
}
```

Применяется в цепочке middleware после `AuthMiddleware`:

```go
// Только курьер может обновлять статус через orders API
orders.PUT("/:id/status", auth, middleware.RoleRequired(models.UserRoleCourier), h.UpdateOrderStatus)

// Только курьер — courier endpoints
couriers.POST("/location", auth, courierOnly, h.UpdateLocation)

// Только сборщик — picker endpoints
pikers.PUT("/orders/:id/status", auth, pickerOnly, h.UpdateStatus)
```

### Как работает цепочка middleware в Gin

```
Request → AuthMiddleware → RoleRequired → Handler
              ↓                ↓
         set user_id,      check role,
         set user_role     403 или Next()
```

Если `AuthMiddleware` вызвал `c.Abort()` — `RoleRequired` и Handler не запустятся.
Если `RoleRequired` вызвал `c.AbortWithStatusJSON(403, ...)` — Handler не запустится.

### Совет

Всегда разделяй Authentication (кто ты?) и Authorization (что тебе можно?).
`AuthMiddleware` — это authentication.
`RoleRequired` — это authorization.
Не смешивай их в одном middleware, иначе код станет нечитаемым и сложным для тестирования.

---

## Исправление 4 — Picker проверяет принадлежность заказа своему магазину

**Файл:** `Backend/internal/picker/service.go`  
**Приоритет:** Critical  
**Проблема:** Сборщик магазина A мог получить и изменить заказ магазина B,
зная его ID. Проверялось только "не взят ли заказ другим пикером",
но не "наш ли это магазин".

### Что изменили

Сигнатура `GetOrder` изменена — теперь принимает `pickerID`:

```go
// Было
func (p *Service) GetOrder(ctx context.Context, orderID uuid.UUID) (*PickerOrderResponse, error)

// Стало
func (p *Service) GetOrder(ctx context.Context, orderID uuid.UUID, pickerID uuid.UUID) (*PickerOrderResponse, error)
```

Добавлена проверка:

```go
pickerStoreID, err := p.getStoreID(ctx, pickerID)
if err != nil {
    return nil, fmt.Errorf("не удалось получить магазин сборщика: %w", err)
}
if order.StoreID != pickerStoreID {
    return nil, fmt.Errorf("заказ не принадлежит вашему магазину")
}
```

`UpdateStatus` теперь использует `GetOrder` с pickerID — проверка магазина
происходит автоматически при каждом обновлении статуса.

### Про ripple effect

Изменение сигнатуры `GetOrder` потребовало обновить:
- интерфейс `PickerService` в `picker/handler.go`
- три места вызова в `picker/handler.go` (GetOrder, AddItem, RemoveItem)

Это называется **ripple effect** — волна изменений от одной правки.
В Go компилятор сам покажет все места где нужно обновить код,
поэтому рефакторинг интерфейсов достаточно безопасен.

### Совет

Принцип "объект должен видеть только то, что ему принадлежит" — это
**Object-Level Authorization** (OOLA), один из самых частых багов в API
по версии OWASP (пункт #1: Broken Object Level Authorization).
При проектировании любого эндпоинта спрашивай себя: а может ли этот пользователь
вообще видеть/менять этот ресурс, не только быть залогиненным?

---

## Исправление 5 — MIME-тип при загрузке файлов

**Файл:** `Backend/internal/admin/handler.go`  
**Приоритет:** Critical  
**Проблема:** Расширение файла бралось из имени (`filepath.Ext(filename)`).
Файл `xss.html` переименованный в `photo.jpg` — принимался и сохранялся,
затем отдавался браузеру как HTML → Stored XSS.

### Что изменили

Добавлена проверка по **магическим байтам** — первым байтам файла,
которые уникальны для каждого формата:

```go
var allowedMIMETypes = []struct {
    magic []byte
    ext   string
}{
    {[]byte{0xFF, 0xD8, 0xFF}, ".jpg"},
    {[]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, ".png"},
    {[]byte{0x47, 0x49, 0x46, 0x38}, ".gif"},
    {[]byte{0x52, 0x49, 0x46, 0x46}, ".webp"},
}
```

Файл открывается, читаются первые 12 байт, сравниваются с таблицей.
Расширение для сохранения берётся из таблицы, а не из имени файла.
WebP проверяется дополнительно (байты 8-12 должны быть `WEBP`).

### Почему именно magic bytes

Расширение файла — это просто строка в имени, её легко подделать.
Magic bytes — часть самого бинарного содержимого файла. JPEG физически
начинается с `FF D8 FF`, это не строка в имени, а структура формата.
Подделать magic bytes так чтобы файл был и валидным JPEG и исполняемым HTML — невозможно.

### Совет

При работе с загружаемыми файлами всегда:
1. Проверяй MIME по magic bytes, не по расширению
2. Генерируй новое имя файла (UUID) — не используй оригинальное имя
3. Храни uploads вне web-root или отдавай через отдельный сервис с правильным `Content-Type`
4. Ограничивай размер файла (в проекте уже есть `MaxMultipartMemory`)

---

## Исправление 6 — Маскировка `?token=` в логах

**Файл:** `Backend/internal/middleware/logging.go`  
**Приоритет:** Critical  
**Проблема:** SSE-соединения передают JWT через query string (`?token=eyJ...`).
Logging middleware логировал `RawQuery` целиком — JWT попадал в Zap и Jaeger.

### Что изменили

Добавлена функция `maskQuery` которая парсит query string
и заменяет значение параметра `token` на `[REDACTED]`:

```go
func maskQuery(raw string) string {
    vals, err := url.ParseQuery(raw)
    if err != nil {
        return "[unparseable]"
    }
    if _, ok := vals["token"]; ok {
        vals.Set("token", "[REDACTED]")
    }
    return vals.Encode()
}
```

### Совет

Логирование — это отдельный "слой безопасности". Список того что
**никогда не должно попадать в логи**: пароли, токены, OTP-коды,
номера карт (PAN), CVV, секретные ключи, session cookies.
Используй `maskPhone`, `maskQuery` и аналогичные функции для всего
что имеет отношение к идентификации пользователя.

---

## Исправление 7 — `verify-code` не принимает роль от клиента

**Файл:** `Backend/internal/auth/service.go`  
**Приоритет:** High  
**Проблема:** Публичный эндпоинт `/auth/verify-code` принимал поле `role` из тела запроса.
Любой мог пройти OTP своего телефона и зарегистрироваться как `COURIER` или `PICKER`.

### Что изменили

```go
// Было — роль бралась из запроса
role, _ := normalizeRole(req.Role)
user.Role = role

// Стало — роль всегда CLIENT, независимо от запроса
user.Role = models.UserRoleClient
```

Роли `PICKER` и `COURIER` выдаются только через прямую работу с БД или admin API.

### Это называется Mass Assignment

Классическая уязвимость: разработчик биндит структуру запроса напрямую в модель,
забывая что клиент может передать любые поля. В данном случае — поле `role`.
Правило: на публичных эндпоинтах явно указывай какие поля принимаешь,
остальные игнорируй или запрещай.

---

## Исправление 8 — Баг `WithTx`: ошибка Commit() терялась

**Файл:** `Backend/internal/database/database.go`  
**Приоритет:** High  
**Проблема:** Без именованного возврата `return err` "замораживал" значение
до запуска defer. Если `tx.Commit()` падал с ошибкой (дедлок, сетевой сбой) —
функция всё равно возвращала `nil`. Вызывающий думал что транзакция прошла успешно.

### Что изменили

```go
// Было — без именованного возврата
func (db *DB) WithTx(...) error {
    ...
    err = fn(tx)
    return err  // defer запустится ПОСЛЕ, но не изменит возвращаемое значение
}

// Стало — именованный возврат
func (db *DB) WithTx(...) (err error) {
    ...
    err = fn(tx)
    return  // "голый" return — defer МОЖЕТ изменить err до фактического возврата
}
```

### Порядок выполнения с именованным возвратом

```
1. err = fn(tx)          — выполняем бизнес-логику
2. return                — Go фиксирует: "вернём именованную err"
3. defer запускается     — err = tx.Commit() → может быть ошибка
4. фактический возврат   — возвращается уже изменённая defer-ом err
```

### Совет

Именованные возвраты в Go — не просто документация. Они дают defer-у
возможность влиять на возвращаемое значение. Используй их именно
для transaction helpers и других мест где defer должен модифицировать результат.
Во всех остальных случаях именованные возвраты усложняют читаемость — не злоупотребляй.

---

---

## Исправление 9 — `/metrics` и `/debug/pprof` защищены авторизацией

**Файл:** `Backend/cmd/api/main.go`  
**Приоритет:** High  
**Проблема:** Оба эндпоинта были открыты публично без какой-либо защиты.

`/metrics` — Prometheus метрики, среди labels был `courier_id` (UUID пользователей).
Злоумышленник мог смотреть активность системы, количество заказов, ID курьеров.

`/debug/pprof` — позволяет:
- Сделать heap dump — извлечь JWT токены прямо из памяти процесса
- Нагрузить CPU через goroutine/CPU профилировщик (вектор DoS)
- Узнать всю структуру запущенных горутин

### Что изменили

Оба эндпоинта теперь требуют Basic Auth через существующий `AdminAuthMiddleware`:

```go
// /metrics
router.GET("/metrics",
    middleware.AdminAuthMiddleware(cfg.Admin),
    gin.WrapH(promhttp.Handler()),
)

// /debug/pprof
pprofAuth := middleware.AdminAuthMiddleware(cfg.Admin)
router.GET("/debug/pprof/*any", pprofAuth, gin.WrapH(http.DefaultServeMux))
```

### Почему AdminAuthMiddleware, а не новый middleware

В проекте уже есть Basic Auth для admin-панели с отдельным логином/паролем
из конфига (`ADMIN_USER`, `ADMIN_PASSWORD`). Это подходящий уровень защиты
для внутренних инструментов. Создавать отдельный механизм не нужно —
это избыточно для текущего этапа.

### Как использовать pprof с авторизацией

```bash
# Просмотр heap dump
curl -u admin:password http://localhost:8080/debug/pprof/heap > heap.out
go tool pprof heap.out

# Prometheus метрики
curl -u admin:password http://localhost:8080/metrics
```

### Совет

`/debug/pprof` — мощный инструмент для отладки production-проблем (утечки памяти,
блокировки горутин), но его никогда не должно быть видно в интернете.
Идеальный вариант — поднять pprof на отдельном порту привязанном к `127.0.0.1`
и обращаться через SSH-туннель. Текущее решение с Basic Auth — приемлемый
промежуточный вариант.

---

---

## Исправление 10 — Hub.Notify: deadlock + перезапись канала без close

**Файл:** `Backend/internal/events/hub.go`  
**Приоритет:** High (Notify deadlock) + Medium (Subscribe overwrite)  
**Проблема 1 (High):** `ch <- message` без `select/default` блокируется при полном буфере.
Один медленный или зависший SSE-клиент вешал горутину навсегда, блокируя
уведомления для всего магазина.

**Проблема 2 (Medium):** `h.mp[storeID] = ch` перезаписывал старый канал без `close`.
При переподключении picker-а горутина читающая из старого канала зависала навечно —
канал никогда не закроется и новых данных не придёт.

### Баг 1: почему ch <- message блокируется

```go
// ❌ БЫЛО
func (h *Hub) Notify(storeID uuid.UUID, message string) {
    ch, ok := h.mp[storeID]
    if ok {
        ch <- message  // блокируется если буфер (10) полон!
    }
}
```

Канал с буфером 10 переполняется если клиент не читает события.
После этого любая горутина вызывающая `Notify` для этого магазина
зависает навечно на `ch <- message`.

### Фикс 1: select/default

```go
// ✅ СТАЛО
select {
case ch <- message:  // отправляем если есть место
default:             // нет места — молча пропускаем, не блокируемся
}
```

`select` с `default` — идиоматичный Go-способ сделать non-blocking channel send.
Если канал занят — идём в `default` и продолжаем работу.

### Баг 2: перезапись канала без close

```go
// ❌ БЫЛО
func (h *Hub) Subscribe(storeID uuid.UUID) chan string {
    ch := make(chan string, 10)
    h.mp[storeID] = ch  // старый канал потерян, но не закрыт
    return ch
}
```

Горутина в SSE-хендлере делает `for msg := range ch` — она завершается
только когда канал закрыт. Если `ch` заменили новым — старый никогда не закроется,
горутина висит вечно. Это **goroutine leak**.

### Фикс 2: close перед перезаписью

```go
// ✅ СТАЛО
if old, ok := h.mp[storeID]; ok {
    close(old)  // сигнал старой горутине завершиться
}
h.mp[storeID] = ch
```

`close(ch)` — стандартный способ сказать читателю "данных больше не будет".
`for msg := range ch` автоматически завершится при закрытии канала.

### Совет

Goroutine leak — частая проблема в Go. Горутина это дёшево (несколько KB),
но если они накапливаются тысячами — память заканчивается.
Правило: каждая горутина должна иметь явный способ завершиться.
Используй `context.Context` для отмены, `close(ch)` для сигнала завершения,
`done chan struct{}` для явного стопа.
Для обнаружения утечек есть инструмент `goleak` (uber-go/goleak).

---

---

## Исправление 11 — CreateOrder: атомарное создание заказа через транзакцию

**Файлы:**
- `Backend/internal/orders/service.go`
- `Backend/internal/orders/repository.go`
- `Backend/internal/orders/postgres_repository.go`
- `Backend/internal/delivery/repository.go` + `postgres_repository.go`
- `Backend/internal/payments/repository.go` + `postgres_repository.go`

**Приоритет:** High  
**Проблема:** Создание заказа состояло из 4 последовательных операций в БД без транзакции:
`Create(order)` → `CreateBatch(items)` → `Create(delivery)` → `Create(payment)`.
Сбой на шаге 3 или 4 оставлял в базе "полузаказ" — заказ с товарами, но без доставки или оплаты.
Такой заказ нельзя ни обработать, ни корректно отменить.

### Архитектурное решение: Transactor интерфейс

Сервис не должен знать про `*sqlx.Tx` — это деталь реализации репозитория.
Чтобы не протаскивать `*database.DB` в сервис, введён отдельный интерфейс:

```go
// orders/service.go
type Transactor interface {
    WithTx(ctx context.Context, fn func(*sqlx.Tx) error) error
}
```

`*database.DB` уже реализует этот метод (после предыдущего фикса).
Сервис получает `Transactor` через конструктор — не знает что это именно БД.

### Tx-методы в репозиториях

К каждому репозиторию добавлен метод `CreateTx(ctx, tx, ...)`:

```go
// Обычный Create — для случаев вне транзакции (остался для совместимости)
func (r *postgresOrderRepository) Create(ctx context.Context, order *models.Order) error

// CreateTx — для использования внутри WithTx
func (r *postgresOrderRepository) CreateTx(ctx context.Context, tx *sqlx.Tx, order *models.Order) error {
    query, args, err := tx.BindNamed(insertOrderQuery, order)
    _, err = tx.ExecContext(ctx, query, args...)
    return err
}
```

`tx.BindNamed` — это sqlx-метод для конвертации именованных параметров (`:id`, `:name`)
в позиционные (`$1`, `$2`) которые понимает PostgreSQL.

### Новый CreateOrder — атомарный

```go
if err = s.transactor.WithTx(ctx, func(tx *sqlx.Tx) error {
    if err := s.orderRepo.CreateTx(ctx, tx, order); err != nil {
        return fmt.Errorf("заказ: %w", err)
    }
    if err := s.orderItemRepo.CreateBatchTx(ctx, tx, orderItems); err != nil {
        return fmt.Errorf("позиции заказа: %w", err)
    }
    if err := s.deliveryRepo.CreateTx(ctx, tx, delivery); err != nil {
        return fmt.Errorf("доставка: %w", err)
    }
    if err := s.paymentRepo.CreateTx(ctx, tx, payment); err != nil {
        return fmt.Errorf("платёж: %w", err)
    }
    return nil
}); err != nil {
    return nil, fmt.Errorf("не удалось создать заказ: %w", err)
}
```

Теперь если любой шаг упал — вся транзакция откатится, БД останется чистой.

### Почему именно Transactor, а не передача *database.DB напрямую

Если дать сервису `*database.DB`, он получит доступ ко всей базе (любые запросы).
`Transactor` — минимальный интерфейс: только запуск транзакции.
Это **Interface Segregation**: зависимость только от того что реально нужно.
Плюс удобно тестировать — можно подменить моком.

### Совет

Правило транзакций в layered architecture:
- **Транзакция начинается в сервисе** (он знает бизнес-операцию целиком)
- **Репозитории принимают tx** если нужно — через отдельные Tx-методы
- **Репозитории не начинают транзакции сами** — они не знают контекст операции

---

---

## Исправление 12 — picker/handler: JSON через json.Marshal вместо fmt.Sprintf

**Файл:** `Backend/internal/picker/handler.go`  
**Приоритет:** High  
**Проблема:** SSE-уведомления собирались через `fmt.Sprintf` с подстановкой строк прямо в JSON:

```go
// ❌ БЫЛО
msg := fmt.Sprintf(`{"type":"order_updated","order_id":"%s","message":"Добавил «%s»","final_total":%.2f}`,
    orderID, req.ProductName, order.FinalTotal)
```

Если `req.ProductName` содержит `"` или `\` — JSON ломается.
Пример: товар называется `Торт "Наполеон"` →
```json
{"message":"Добавил «Торт "Наполеон"»"}  // ← невалидный JSON, парсер упадёт
```

### Что изменили

Добавлена структура с json-тегами и вспомогательная функция:

```go
type orderUpdatedEvent struct {
    Type       string  `json:"type"`
    OrderID    string  `json:"order_id"`
    Message    string  `json:"message"`
    FinalTotal float64 `json:"final_total"`
}

func notifyOrderUpdated(hub *events.Hub, userID, orderID uuid.UUID, message string, finalTotal float64) {
    event := orderUpdatedEvent{...}
    data, _ := json.Marshal(event)  // json.Marshal экранирует все спецсимволы
    hub.Notify(userID, string(data))
}
```

`json.Marshal` автоматически экранирует `"` → `\"`, `\` → `\\`, и другие спецсимволы.
Результат всегда валидный JSON, независимо от содержимого полей.

### Совет

Правило простое: **никогда не строй JSON конкатенацией строк или fmt.Sprintf**.
Используй структуры с `json`-тегами или `map[string]any` + `json.Marshal`.
Это касается любого структурированного формата: JSON, XML, SQL (параметризованные запросы), HTML (шаблоны).
Конкатенация строк в structured formats — прямой путь к багам и уязвимостям.

---

## Общие советы по архитектуре backend

### Слой handler (HTTP)
- Отвечает только за: разбор запроса, вызов сервиса, формирование ответа
- Не должен содержать бизнес-логику
- Всегда проверяй `user_id` и `user_role` из контекста, не из тела запроса

### Слой service (бизнес-логика)
- Не знает про HTTP — принимает и возвращает доменные объекты
- Транзакции должны начинаться здесь, не в handler и не в repository
- Проверки владения ресурсом (`order.StoreID == pickerStoreID`) — здесь

### Слой repository (БД)
- Только SQL-запросы, никакой бизнес-логики
- Каждый метод работает с одной таблицей или связанными таблицами
- Принимает `*sqlx.Tx` когда нужна транзакция

### Middleware
- Authentication (проверка токена) и Authorization (проверка роли) — разные middleware
- Не клади бизнес-логику в middleware — только сквозные concerns (auth, logging, metrics)

### Безопасность
- Никогда не доверяй данным от клиента для определения роли, владельца, цены
- Всегда проверяй принадлежность ресурса (OWASP BOLA/IDOR)

---

## Исправление 13 — Docker: запуск не от root

**Файл:** `Backend/Dockerfile`  
**Приоритет:** High  
**Проблема:** Контейнер запускался от пользователя `root` (UID 0).
При успешной RCE-атаке (Remote Code Execution) через уязвимость в приложении
атакующий сразу получает root внутри контейнера. Это упрощает:
- побег из контейнера через уязвимости ядра (`runc`, `containerd`)
- доступ к секретам других контейнеров через shared volumes
- горизонтальное перемещение по кластеру (если Kubernetes)

### Что изменили

```dockerfile
# Создаём непривилегированного пользователя
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/bin/api .
COPY --from=builder /go/bin/goose /usr/local/bin/goose
COPY --from=builder /app/migrations ./migrations

# Передаём владение файлами
RUN chown -R appuser:appgroup /app

# Переключаемся — всё дальше запускается не от root
USER appuser

CMD ["./api"]
```

Три изменения в связке:
1. `addgroup -S / adduser -S` — системный пользователь без пароля и shell
2. `chown -R appuser:appgroup /app` — без этого `appuser` не прочитает бинарник
3. `USER appuser` — переключение до `CMD`

### Флаг -S (system)

`adduser -S` создаёт пользователя без:
- домашней директории (`/home/appuser` не создаётся)
- пароля (нет записи в `/etc/shadow`)
- интерактивного shell (`/sbin/nologin`)

Даже если атакующий получит RCE от имени `appuser`, он не сможет
интерактивно войти в систему через этого пользователя.

### Почему WORKDIR сменили с /root/ на /app

`/root/` — домашняя директория root-пользователя.
Класть туда рабочие файлы приложения — плохая практика даже если запускаешь от root.
`/app` — нейтральная директория, стандарт для приложений в контейнерах.

### Совет

**Принцип минимальных привилегий (Principle of Least Privilege)** —
каждый процесс должен иметь только те права, которые нужны для его работы.
Go-бинарник для веб-сервера не нуждается в root. Ему нужно:
- читать конфиг и бинарник
- слушать порт > 1024 (порты < 1024 требуют root только на bare metal, в Docker это не нужно)
- писать в `/app` если есть uploads

Проверить от кого запущен процесс в контейнере:
```bash
docker exec <container> id
# uid=100(appuser) gid=101(appgroup)  ← правильно
# uid=0(root)                         ← неправильно
```

---

## Исправление 14 — Rate limit на /auth/request-code (защита от SMS-флуда)

**Файлы:** `internal/auth/otp_limiter.go`, `internal/cache/keys.go`, `internal/auth/service.go`, `cmd/api/main.go`  
**Приоритет:** High  
**Проблема:** Эндпоинт `/auth/request-code` не имел никаких ограничений.
Злоумышленник мог в цикле отправлять тысячи SMS на чужой номер,
накапливая долг (SMS стоят денег) и создавая неудобства жертве.

### Что изменили

**1. `cache/keys.go` — отдельный Redis-ключ для SMS-лимита**

```go
const OTPSendKey = "otp:send:%s"
```

Почему отдельный ключ от `OTPAttemptsKey`? Два лимитера — две независимые
защиты с разными параметрами:
- `request-code`: 3 запроса за 10 минут — SMS дороже, лимит строже
- `verify-code`: 5 попыток за 15 минут — брутфорс кода опаснее, TTL длиннее

**2. `auth/otp_limiter.go` — `keyPattern` вместо захардкоженного ключа**

Структура `RedisOTPLimiter` получила поле `keyPattern string`.
`NewRedisOTPLimiter` теперь принимает его как параметр:

```go
// Было (только для verify-code, ключ захардкожен)
func NewRedisOTPLimiter(rdb, maxAttempts, blockTTL) OTPLimiter

// Стало (переиспользуется для обоих лимитеров)
func NewRedisOTPLimiter(rdb, maxAttempts, blockTTL, keyPattern string) OTPLimiter
```

Это паттерн **параметризованного конструктора** — одна реализация покрывает
несколько случаев без дублирования кода.

**3. `auth/service.go` — второй лимитер в `RequestCode`**

```go
type AuthService struct {
    otpLimiter      OTPLimiter // verify-code: 5 попыток / 15 мин
    sendCodeLimiter OTPLimiter // request-code: 3 запроса / 10 мин
}
```

Первая строка `RequestCode` — проверка лимита:

```go
func (s *AuthService) RequestCode(ctx context.Context, phone string) error {
    _, blocked, err := s.sendCodeLimiter.CheckAndIncrement(ctx, phone)
    if blocked {
        return ErrOTPBlocked
    }
    // ... остальная логика
}
```

Обрати внимание: лимитер вызывается ДО отправки SMS. Если вызвать после —
при ошибке лимит уже израсходован, но SMS не ушёл.

**4. `cmd/api/main.go` — два лимитера в точке сборки**

```go
otpLimiter := auth.NewRedisOTPLimiter(
    redisClient.Client(), 5, 15*time.Minute, cache.OTPAttemptsKey,
)
sendCodeLimiter := auth.NewRedisOTPLimiter(
    redisClient.Client(), 3, 10*time.Minute, cache.OTPSendKey,
)

authService := auth.NewAuthService(
    authRepo, userRepo, cfg.JWT.Secret, smsProvider,
    logger, otpLimiter, sendCodeLimiter, cfg.SMS.TestMode,
)
```

Оба лимитера используют один Redis connection pool — не создаётся лишнее
TCP-соединение. Клиент Redis thread-safe, шарить его безопасно.

### Почему именно такие лимиты

| Параметр | verify-code | request-code |
|---|---|---|
| `maxAttempts` | 5 | 3 |
| `blockTTL` | 15 мин | 10 мин |
| Защищает от | брутфорса кода | SMS-флуда |

Эти значения — стандарт Twilio Verify и AWS Cognito.
3 попытки SMS за 10 минут достаточно для нормального пользователя
(не пришло → ещё раз → ещё раз), но блокирует автоматическую отправку.

### Совет

**Разделяй rate limits** по смыслу:
- Лимит на запрос ресурса (SMS, email) — защита от флуда и финансовых потерь
- Лимит на использование ресурса (ввод кода) — защита от брутфорса
- Лимит на логин (неверный пароль) — защита от перебора паролей

Один общий "rate limit 10 запросов в минуту" — слишком грубо.
Разные эндпоинты требуют разных лимитов с разными мотивациями.
- Секреты — только через переменные окружения, никогда в коде

---

## Исправление 15 — JWT отзыв токенов (механизм logout)

**Файлы:** `internal/auth/token_revoker.go` (новый), `internal/cache/keys.go`, `internal/auth/service.go`, `internal/auth/handler.go`, `internal/middleware/auth.go`, и 5 handler-файлов с интерфейсами  
**Приоритет:** High  
**Проблема:** После выдачи JWT токен нельзя было аннулировать. Если токен украли или пользователь нажал "выйти" — токен продолжал работать ещё 24 часа до истечения `exp`.

---

### Что такое JWT и почему с ним сложно делать logout

JWT (JSON Web Token) — токен который сам несёт всю информацию о пользователе. Сервер не хранит список активных сессий — он просто проверяет подпись. Это называется **stateless authentication**.

**Плюс:** не нужна БД при каждом запросе — только криптографическая проверка подписи.  
**Минус:** нельзя "удалить" токен на сервере — он существует пока не истечёт `exp`.

Для сравнения, в **session-based auth** (cookies + сессии) logout работает так:
```
DELETE FROM sessions WHERE id = $1
```
И токен сразу мёртв. С JWT так не получится — нет централизованного хранилища.

---

### Три подхода к отзыву JWT

**1. Короткий TTL (15 мин) + refresh tokens**  
Access token живёт 15 минут. Refresh token живёт 30 дней и хранится в httpOnly cookie.
При logout удаляем refresh token из БД — новый access token выдать уже нельзя.
После 15 минут старый access token истечёт сам.

*Используют:* Google, GitHub, большинство OAuth2 провайдеров.  
*Минус:* сложнее — два токена, refresh endpoint, ротация.

**2. Блэклист JTI в Redis (наш подход)**  
При logout сохраняем уникальный ID токена (JTI) в Redis с TTL = оставшееся время жизни токена.
При каждой проверке токена смотрим: не в блэклисте ли этот JTI?

*Используют:* стартапы, монолиты, API с нечастым logout.  
*Плюс:* простота. *Минус:* Redis overhead на каждый запрос.

**3. Версионирование токенов**  
В БД у пользователя хранится `token_version: int`. В JWT кладём эту версию.
При logout инкрементируем версию в БД. `ValidateToken` проверяет: совпадает ли версия?

*Плюс:* можно разлогинить ВСЕХ пользователей сразу (инкремент глобальной версии).  
*Минус:* запрос в БД на каждую проверку токена.

**Почему выбрали блэклист JTI:**  
- Простая реализация — один Redis SET/GET
- Redis уже есть в проекте (OTP лимиты, курьеры)
- Для стартапа logout — редкое событие, блэклист почти всегда пустой

---

### Что добавили: JTI (JWT ID)

`jti` — стандартное поле JWT (RFC 7519). Уникальный UUID каждого конкретного токена.

```go
// Было: три поля
claims := jwt.MapClaims{
    "user_id": userID.String(),
    "role":    role,
    "exp":     time.Now().Add(24 * time.Hour).Unix(),
}

// Стало: добавлен jti
claims := jwt.MapClaims{
    "user_id": userID.String(),
    "role":    role,
    "jti":     uuid.New().String(), // ← уникальный ID этого конкретного токена
    "exp":     time.Now().Add(24 * time.Hour).Unix(),
    "iat":     time.Now().Unix(),
}
```

Зачем нужен `jti` а не просто `user_id`:
- У одного пользователя может быть несколько активных токенов (несколько устройств)
- Нужно отозвать **один конкретный** токен, а не все сразу
- По `user_id` нельзя различить "телефон" от "компьютера"

---

### Новый файл: `token_revoker.go`

```go
type TokenRevoker interface {
    Revoke(ctx context.Context, jti string, ttl time.Duration) error
    IsRevoked(ctx context.Context, jti string) (bool, error)
}
```

`RedisTokenRevoker`:
- `Revoke` → `SET jwt:revoked:{jti} "1" EX {ttl_seconds}`
- `IsRevoked` → `GET jwt:revoked:{jti}` (redis.Nil = не отозван, ключ есть = отозван)

Почему `SET key "1" EX ttl` а не `SADD revoked jti`:
- SET с TTL — каждый ключ удаляется автоматически когда токен истекает
- SADD в один Set — нельзя задать разный TTL для разных токенов, нужен cron для очистки

---

### Новый метод: `Logout`

```go
func (s *AuthService) Logout(ctx context.Context, tokenString string) error {
    // Парсим токен, достаём JTI и exp
    claims := ...

    ttl := time.Until(time.Unix(int64(exp), 0))
    if ttl <= 0 {
        return nil // уже истёк — добавлять бессмысленно
    }

    return s.revoker.Revoke(ctx, jti, ttl)
}
```

TTL блэклист-записи = оставшееся время жизни токена. Логика:
- Токен выдан в 10:00, живёт 24 часа → истекает в 10:00+1 день
- Logout в 11:00 → TTL блэклиста = 23 часа
- В 10:00+1 день Redis автоматически удаляет запись
- Блэклист не растёт бесконечно

---

### Context в ValidateToken

```go
// Было
ValidateToken(tokenString string) (uuid.UUID, string, error)

// Стало
ValidateToken(ctx context.Context, tokenString string) (uuid.UUID, string, error)
```

Почему context обязателен для Redis-вызова:
- Context несёт deadline/timeout от HTTP запроса
- Если запрос уже отменён клиентом — не нужно идти в Redis
- `context.Background()` внутри метода — антипаттерн: теряется трассировка и timeout

Это изменение затронуло 6 файлов с интерфейсами (`TokenValidator` в middleware + `AuthService` в 5 хэндлерах). Это **ripple effect** — волна от одного изменения. Компилятор Go сам нашёл все места — это ценность строгой типизации.

---

### Новый эндпоинт

```
POST /api/v1/auth/logout
Authorization: Bearer <token>

Response 200: {"message": "успешный выход"}
```

Защищён `AuthMiddleware` — нельзя вызвать без валидного токена. Handler достаёт токен из заголовка (AuthMiddleware уже проверил формат) и передаёт в `authService.Logout`.

---

### Graceful degradation при недоступности Redis

```go
revoked, revokeErr := s.revoker.IsRevoked(ctx, jti)
if revokeErr != nil && s.logger != nil {
    s.logger.Warn("token revoker недоступен, пропускаем проверку")
}
if revoked {
    return uuid.Nil, "", ErrTokenRevoked
}
```

При падении Redis — логируем предупреждение и пропускаем проверку блэклиста.
Токен продолжает работать. Это лучше, чем заблокировать всех пользователей.
Мониторинг Redis (алерты на недоступность) — отдельная задача.

---

### Совет: три разных ошибки — три разных HTTP кода

```go
case errors.Is(err, ErrTokenRevoked):
    c.JSON(401, gin.H{"error": "токен отозван, войдите заново"})
// vs
case errors.Is(err, jwt.ErrTokenExpired):
    c.JSON(401, gin.H{"error": "токен истёк"})
// vs
default:
    c.JSON(401, gin.H{"error": "неверный токен"})
```

Фронтенд и iOS могут по-разному реагировать:
- "Токен истёк" → тихо рефрешим (если есть refresh token)
- "Токен отозван" → показываем "Вы были разлогинены с другого устройства"
- "Неверный токен" → редирект на логин

Sentinel errors (`errors.New`) + `errors.Is` — стандартный способ разграничивать ошибки в Go с версии 1.13.
