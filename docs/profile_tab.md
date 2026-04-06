# Profile Tab — Документация

## Задача

Перенести историю заказов из отдельной вкладки TabBar в личный кабинет.
Таб "Заказы" убирается — вместо него появляется таб "Профиль".
Внутри профиля: информация о пользователе + история заказов.

---

## Что изменилось

### До
```
TabBar: [Каталог] [Магазины] [Избранное] [Корзина] [Заказы]
Header: кнопка "Кабинет" → dropdown (инфо + выход)
```

### После
```
TabBar: [Каталог] [Магазины] [Избранное] [Корзина] [Профиль]
Header: кнопка "Кабинет" → открывает таб Профиль
ProfileTab: блок инфо пользователя + история заказов
```

---

## Затронутые файлы

| Файл | Что изменено |
|------|-------------|
| `components/profile/ProfileTab.tsx` | Создан (новый) |
| `components/layout/TabBar.tsx` | "orders" → "profile", иконка человека |
| `components/layout/Header.tsx` | Кнопка "Кабинет" → `onProfileClick()` вместо dropdown |
| `app/page.tsx` | Добавлен prop `onProfileClick` в Header, рендер ProfileTab |

---

## Архитектура ProfileTab

```
ProfileTab
├── Неавторизован → заглушка с кнопкой "Войти"
└── Авторизован
    ├── ProfileCard       — аватар, телефон, роль, ID
    └── OrderHistory      — список заказов (бывший OrdersTab)
        ├── Loading skeleton
        ├── Empty state
        └── OrderCard[]
```

### Почему не выносим OrderCard в отдельный файл

OrderCard используется только внутри ProfileTab. Правило: не создавать
отдельный файл для компонента который используется в одном месте.
Если в будущем OrderCard понадобится ещё где-то — вынесем тогда.

---

## Взаимодействие Header ↔ Page ↔ TabBar

```
page.tsx
  │
  ├─ activeTab state
  │
  ├─► Header: onProfileClick={() => setActiveTab("profile")}
  │     Кнопка "Кабинет" → вызывает onProfileClick
  │     Кнопка "Выйти" → остаётся в dropdown через состояние
  │
  └─► TabBar: active={activeTab} onChange={setActiveTab}
        Таб "Профиль" → setActiveTab("profile")
```

Два способа открыть профиль:
1. Кнопка "Кабинет" в Header
2. Таб "Профиль" в TabBar

Оба меняют один и тот же `activeTab` в `page.tsx`.
Это называется "single source of truth" — одно состояние, два триггера.

---

## Лучшие практики

### Переиспользование логики загрузки заказов

Логика `useEffect + ordersApi.getOrders()` из старого `OrdersTab`
переносится как есть в `ProfileTab`. Не создаём отдельный хук,
потому что это единственное место использования.

В будущем если нужно будет показывать заказы ещё где-то —
вынести в `hooks/useOrders.ts`:
```ts
export function useOrders() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  // ...
  return { orders, loading };
}
```

### Почему не удаляем OrdersTab.tsx сразу

Файл `OrdersTab.tsx` остаётся в проекте, но больше не используется.
Можно удалить — в этом же PR. Оставлять мёртвый код не стоит:
он путает следующего разработчика (и тебя через месяц).

---

## Что будет добавлено позже

Место под баллы уже заложено в ProfileCard — блок с иконкой звезды
и текстом "скоро". Когда будет реализована система баллов (TASK-011),
заменить заглушку на реальные данные.

---

## Git

Ветка: `feature/profile-tab`
База: `main`

После тестирования:
```bash
git push origin feature/profile-tab
# Затем создать MR в GitLab
```
