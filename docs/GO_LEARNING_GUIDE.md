# Go — гид по изучению через код проекта

Ты пишешь реальный продакшн-код. Это лучший способ учиться.
Ниже — конкретные места в коде Laman-App, которые стоит изучить, и что читать рядом с ними.

---

## 1. Concurrency: Hub и каналы

**Файл:** `Backend/internal/events/hub.go`

30 строк кода — а внутри вся суть Go concurrency.

```go
type Hub struct {
    mp map[uuid.UUID]chan string
    mu sync.RWMutex
}
```

**Что изучить:**
- Зачем `RWMutex` а не просто `Mutex`? (Read lock позволяет нескольким горутинам читать одновременно)
- Почему канал буферизован: `make(chan string, 10)`? Что будет если убрать `10`?
- Зачем `close(ch)` при Unsubscribe — и что произойдёт если не закрыть?
- Что случится если две горутины одновременно вызовут `Notify` на один канал?

**Эксперимент:** убери `RWMutex`, запусти несколько горутин — получишь `concurrent map read and map write` и панику. Это race condition.

**Читать:**
- [Go Tour: Concurrency](https://go.dev/tour/concurrency/1) — официальный тур, раздел Concurrency целиком
- [Go by Example: Channels](https://gobyexample.com/channels)
- [Go by Example: Mutexes](https://gobyexample.com/mutexes)
- Книга: **"Concurrency in Go"** — Katherine Cox-Buday (лучшая книга по теме)

---

## 2. select + context.Done() — управление горутинами

**Файл:** `Backend/internal/picker/handler.go` — метод `Events`

```go
for {
    select {
    case message, ok := <-ch:
        if !ok {
            return
        }
        c.SSEvent("message", message)
        c.Writer.Flush()
    case <-c.Request.Context().Done():
        return
    }
}
```

**Что изучить:**
- `select` — это `switch` для каналов. Срабатывает тот `case` чей канал готов первым
- `context.Done()` — канал который закрывается когда клиент отключается (закрыл браузер, сеть упала)
- `ok` при чтении из канала — `false` означает что канал закрыт
- Без `context.Done()` горутина зависла бы навсегда — это называется goroutine leak

**Эксперимент:** убери `case <-c.Request.Context().Done()`. Открой SSE в браузере, закрой вкладку. Горутина продолжит жить — проверь через `runtime.NumGoroutine()`.

**Читать:**
- [Go blog: Context](https://go.dev/blog/context) — официальный блог, обязательно
- [Go by Example: Select](https://gobyexample.com/select)
- [Goroutine Leaks](https://www.ardanlabs.com/blog/2018/11/goroutine-leaks-the-forgotten-sender.html) — Ardan Labs

---

## 3. State Machine — явные переходы состояний

**Файл:** `Backend/internal/models/order.go` — функция `IsValidStateTransition`

```go
func IsValidStateTransition(current, next OrderStatus) bool {
    validTransitions := map[OrderStatus][]OrderStatus{
        OrderStatusNew: {OrderStatusAcceptedByPicker, OrderStatusCancelled},
        ...
    }
    ...
}
```

**Что изучить:**
- Паттерн State Machine — состояния и явные переходы между ними
- Почему это лучше чем просто `UPDATE orders SET status = $1`?
- Что было бы без этой проверки? (курьер мог бы перевести заказ из DELIVERED обратно в NEW)
- Как map[K][]V используется для описания графа переходов

**Подумай:** можно ли сделать это через enum + таблицу в БД? Какие плюсы и минусы?

**Читать:**
- [State Machine паттерн](https://refactoring.guru/design-patterns) — раздел Behavioral patterns
- [Enums в Go](https://go.dev/blog/iota) — про `iota` и константы

---

## 4. SQL vs Go логика — где считать?

**Файл:** `Backend/internal/picker/postgres_repository.go` — метод `RecalcOrderTotals`

```go
query := `
    UPDATE orders
    SET items_total = COALESCE((SELECT SUM(price * quantity) FROM order_items WHERE order_id = $1), 0),
        service_fee = ... * $2 / 100,
        final_total = ... + delivery_fee,
        updated_at = NOW()
    WHERE id = $1
`
```

**Что изучить:**
- Вариант А (Go): достать items → посчитать сумму → обновить orders
- Вариант Б (SQL): одним UPDATE посчитать и записать

**Почему Б лучше:**
- Атомарность — нет окна между чтением и записью (race condition)
- Меньше round-trips к БД
- Если два пикера одновременно меняют заказ — SQL сам разберётся через транзакции

**Читать:**
- [Use The Index, Luke](https://use-the-index-luke.com/) — лучший бесплатный ресурс по SQL для разработчиков
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)

---

## 5. Interface Segregation — минимальные интерфейсы

**Файл:** `Backend/internal/picker/handler.go`

```go
// Интерфейс определён там где используется, а не там где реализован
type PickerService interface {
    Login(ctx context.Context, login LoginRequest) (LoginResponse, error)
    GetOrder(ctx context.Context, orderID uuid.UUID) (*PickerOrderResponse, error)
    ...
}
```

**Что изучить:**
- В Go интерфейсы реализуются неявно (duck typing)
- Интерфейс определяется на стороне потребителя — хендлер говорит "мне нужно вот это", а не сервис говорит "я даю вот это"
- Маленький интерфейс → легче тестировать (можно подменить моком)
- Сравни: `PickerService` в handler.go vs реальный `*Service` в service.go — у реального больше методов

**Эксперимент:** напиши мок `PickerService` для теста хендлера — убедись что тебе не нужна реальная БД.

**Читать:**
- [Go blog: Laws of Reflection](https://go.dev/blog/laws-of-reflection)
- [Effective Go: Interfaces](https://go.dev/doc/effective_go#interfaces)
- [Accept interfaces, return structs](https://medium.com/@cep21/what-accept-interfaces-return-structs-means-in-go-2fe879e25ee8) — важная идиома Go

---

## 6. Dependency Injection через конструкторы

**Файл:** `Backend/cmd/api/main.go`

```go
pickerRepo := picker.NewPostgresPikerRepository(db)
pickerService := picker.NewPickerService(pickerRepo, userRepo, cfg.JWT.Secret, 5.0, logger)
pickerHandler := picker.NewHandler(pickerService, logger, authService, hub)
```

**Что изучить:**
- В Go нет DI-контейнеров как в Java/Spring — всё делается вручную через конструкторы
- `main.go` — это "корень" зависимостей, место где всё собирается
- Почему зависимости передаются через конструктор, а не создаются внутри?

**Подумай:** что если `pickerService` создавал бы `db` внутри себя? Как бы ты тогда протестировал его без реальной БД?

**Читать:**
- [Dependency Injection in Go](https://www.alexedwards.net/blog/organising-database-access) — Alex Edwards
- [Wire](https://github.com/google/wire) — DI-генератор от Google (для ознакомления)

---

## Порядок изучения

```
1. hub.go                    ← каналы, mutex, concurrency основы
2. IsValidStateTransition     ← state machine, map в Go
3. Events handler (select)    ← context, goroutine lifecycle
4. RecalcOrderTotals          ← SQL vs Go логика
5. Interface в handler.go     ← ISP, тестируемость
6. main.go целиком            ← как собирается приложение
```

---

## Что читать системно

### Бесплатно онлайн
| Ресурс | Что даёт |
|---|---|
| [go.dev/tour](https://go.dev/tour) | Официальный тур, начни отсюда |
| [gobyexample.com](https://gobyexample.com) | Примеры на каждую фичу языка |
| [Effective Go](https://go.dev/doc/effective_go) | Идиоматичный Go от создателей |
| [go.dev/blog](https://go.dev/blog) | Официальный блог, статьи про concurrency и context — обязательны |
| [Ardan Labs Blog](https://www.ardanlabs.com/blog/) | Глубокие статьи про Go internals |

### Книги
| Книга | Уровень |
|---|---|
| **"The Go Programming Language"** — Donovan, Kernighan | Начинающий → средний. Библия Go |
| **"Concurrency in Go"** — Katherine Cox-Buday | Средний. Лучшая по concurrency |
| **"Let's Go"** — Alex Edwards | Начинающий. Веб-приложение с нуля, очень практично |
| **"100 Go Mistakes"** — Teiva Harsanyi | Средний → продвинутый. Разбор типичных ошибок |

### YouTube
- **Anthony GG** — практичные видео про Go паттерны
- **TechWorld with Nana** — Go для бэкенда, Docker, Kubernetes

---

## Конкретный совет

Не читай всё подряд. Лучший цикл:

```
Увидел незнакомую конструкцию в коде
    → погуглил + прочитал gobyexample.com
    → написал маленький изолированный пример
    → вернулся в код проекта и понял зачем оно там
```

Всё что написано в этом проекте — реальные паттерны которые используются в продакшн Go-сервисах. Ты уже пишешь правильно.
