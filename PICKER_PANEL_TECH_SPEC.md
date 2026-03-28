# ТЗ: Панель Сборщика (React) для Laman

## 1. Цель

Сделать отдельную web-панель сборщика, интегрированную с текущим Go backend, чтобы сборщик мог:

- авторизоваться по телефону/паролю
- видеть очередь заказов своего магазина
- открывать карточку заказа
- обновлять статусы заказа по валидному workflow
- получать новые заказы в реальном времени

Цель реализации: production-ready MVP, близкий к практикам крупных e-commerce команд (Ozon/WB-style операционная панель), с качеством по UX, устойчивости, тестируемости и наблюдаемости.

## 2. Границы релиза (Scope v1)

В релиз v1 входит:

- Login сборщика (`PICKER`)
- Список заказов (таблица/лента)
- Карточка заказа
- Изменение статуса заказа
- Real-time обновления через SSE
- Ошибки/ретраи/пустые состояния
- Базовая метрика фронта и логирование ошибок
- Unit + integration + e2e-smoke тесты

В релиз v1 не входит:

- управление пользователями сборщиков
- аналитические дашборды
- оффлайн-режим
- мультимагазинность в одном аккаунте
- курьерский функционал

## 3. Роли и доступ

- `PICKER`: доступ только к своей панели и заказам своего `store_id`
- `ADMIN`: вне scope панели сборщика (живет в существующей админке)
- `CLIENT/COURIER`: в панель сборщика не допускаются

## 4. Backend API (источник истины)

Используем существующие маршруты:

- `POST /api/v1/picker/auth/login`
  - request: `{ "phone": "string", "password": "string" }`
  - response: `{ "token": "jwt", "user_id": "uuid", "store_id": "uuid", "role": "PICKER" }`

- `GET /api/v1/picker`
  - auth: `Authorization: Bearer <token>`
  - response: `Order[]` (только заказы магазина сборщика)

- `GET /api/v1/picker/orders/:id`
  - auth required
  - response: `Order`

- `PUT /api/v1/picker/orders/:id/status`
  - auth required
  - request: `{ "status": "ORDER_STATUS" }`
  - response: `200 { message: "..." }`

- `GET /api/v1/picker/events` (SSE)
  - auth required
  - события о новых заказах/обновлениях

## 5. Бизнес-правила

### 5.1 Статусы (v1)

Поддерживаем backend workflow:

- `NEW`
- `ACCEPTED_BY_PICKER`
- `ASSEMBLING`
- `ASSEMBLED`
- `WAITING_COURIER`
- `COURIER_PICKED_UP`
- `DELIVERING`
- `DELIVERED`
- `CANCELLED`
- `NEEDS_CONFIRMATION`

### 5.2 Разрешенные действия сборщика

Сборщик в v1 управляет только этапами сборки:

- `NEW -> ACCEPTED_BY_PICKER`
- `ACCEPTED_BY_PICKER -> ASSEMBLING`
- `ASSEMBLING -> ASSEMBLED`
- `ACCEPTED_BY_PICKER -> NEEDS_CONFIRMATION`
- `NEEDS_CONFIRMATION -> ASSEMBLING`

Переходы вне этих правил должны быть недоступны в UI и блокироваться backend.

### 5.3 Ограничение магазина

Сборщик видит только заказы своего `store_id` (на стороне backend уже реализовано).

## 6. UX сценарии

### 6.1 Login

- Ввод телефона и пароля
- Ошибки валидации до запроса
- Ошибка 401: понятный текст "Неверный телефон или пароль"
- Сохранение JWT в `localStorage` (v1) + опционально fallback в memory

### 6.2 Очередь заказов

- По умолчанию показываются активные заказы сборки:
  - `NEW`, `ACCEPTED_BY_PICKER`, `ASSEMBLING`, `NEEDS_CONFIRMATION`, `ASSEMBLED`
- Сортировка:
  - primary: по приоритету статуса
  - secondary: `created_at ASC`
- Поиск по короткому ID и телефону
- Быстрые фильтры: `Новые`, `В сборке`, `Проблемные`

### 6.3 Карточка заказа

- ID, время создания, клиент, телефон, адрес, комментарий
- Состав заказа
- Текущий статус
- Кнопки только допустимых следующих статусов
- Кнопка "Обновить" и автосинхронизация через SSE

### 6.4 Real-time

- SSE-подключение после логина
- При событии:
  - мягкий refetch списка
  - toast "Новый заказ"
- Реконнект с backoff: 1s, 2s, 5s, 10s, 20s (max)

## 7. Техническая архитектура фронта

## 7.1 Stack

- React 18 + TypeScript
- Vite
- React Router
- TanStack Query (fetch/cache/retry/invalidate)
- Zustand (минимальный UI/session store)
- Zod (валидация DTO)
- Axios или `fetch` wrapper с interceptors
- UI-kit: MUI/Antd или headless + собственные компоненты (решение на старте проекта)

### 7.2 Структура проекта

```
picker-panel/
  src/
    app/
      router/
      providers/
    pages/
      login/
      orders/
      order-details/
    widgets/
      order-list/
      order-filters/
      order-status-actions/
    features/
      auth/
      order-status-update/
      sse-sync/
    entities/
      order/
      user/
    shared/
      api/
      lib/
      ui/
      config/
      types/
```

### 7.3 API слой

- Единый `apiClient` с baseURL из env
- Автоподстановка `Authorization` из session store
- Нормализация ошибок в единый формат
- DTO маппинг и runtime валидация ответов (Zod)

### 7.4 SSE слой

- Отдельный сервис `pickerEventsClient`
- Поддержка reconnect/backoff
- Graceful stop при logout
- Метрики: `sse_connected`, `sse_reconnect_attempts`

## 8. Нефункциональные требования

- Производительность:
  - список до 500 заказов без деградации UX
  - реакция UI на смену статуса < 300ms локально
- Надежность:
  - recover после сетевого сбоя без reload страницы
- Безопасность:
  - очистка токена при 401
  - запрет доступа к private routes без session
- Поддерживаемость:
  - strict TypeScript
  - единый styleguide и линтинг

## 9. Тестовая стратегия

### 9.1 Unit

- маппинг статусов
- валидация transition rules
- auth/session store reducers
- SSE reconnect policy

### 9.2 Integration (React Testing Library + MSW)

- login success/fail
- загрузка списка заказов
- смена статуса с invalidation кэша
- обработка 401/500

### 9.3 E2E smoke (Playwright/Cypress)

- happy path:
  - login -> список -> карточка -> смена статуса
- sse scenario:
  - эмуляция события -> заказ появляется без reload

### 9.4 Coverage

- Unit+Integration минимум 70% по statements для core feature-модулей

## 10. CI/CD для picker-panel

- Pipeline stages:
  - lint
  - typecheck
  - test (unit+integration)
  - build
  - e2e-smoke (опционально nightly или MR label)
- Артефакты:
  - test report
  - coverage report
  - production bundle

## 11. Логирование и наблюдаемость

- Frontend event log (console + отправка в collector в будущем):
  - `auth_login_success/fail`
  - `order_status_update_success/fail`
  - `sse_connected/disconnected/reconnect`
- Error boundary на app-level
- Correlation ID из backend ответа (если есть) прокидывать в лог

## 12. Definition of Done (DoD)

Фича считается завершенной, если:

- все страницы и сценарии из Scope v1 реализованы
- backend integration работает в dev окружении end-to-end
- unit/integration тесты зеленые
- e2e smoke зеленый
- нет критических багов по auth/status flow
- документация по запуску и env обновлена

## 13. План этапов

### Этап 1: Foundation (1-2 дня)

- bootstrap проекта
- auth/session
- api client
- базовый layout

### Этап 2: Orders core (2-3 дня)

- список заказов
- карточка заказа
- статусные действия

### Этап 3: Real-time + hardening (1-2 дня)

- SSE integration
- reconnect/error UX
- доработка фильтров/поиска

### Этап 4: Tests + release prep (1-2 дня)

- unit/integration/e2e smoke
- CI pipeline
- docs/runbook

## 14. Риски

- нестабильный контракт по статусам/полям заказа
- несовпадение формата SSE событий
- изменения auth модели для picker в backend

Снижение риска:

- контрактные DTO тесты
- feature flags на realtime
- быстрый fallback на polling

## 15. Следующий шаг

После утверждения этого ТЗ стартуем реализацию `picker-panel` как отдельный React проект в репозитории и подключаем к текущему backend по указанным endpoint-ам.
