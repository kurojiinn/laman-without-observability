import { useMemo } from "react";
import { AppShell } from "../../shared/ui/AppShell";
import { useSession } from "../../features/auth/sessionStore";
import { usePickerOrders } from "../../features/orders/hooks";
import { formatPrice } from "../../shared/lib/format";
import { useTheme, setTheme } from "../../shared/lib/themeStore";
import { PushToggle } from "../../features/push/PushToggle";
import type { OrderStatus } from "../../entities/order/model";

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const assembledStatuses: OrderStatus[] = [
  "ASSEMBLED",
  "WAITING_COURIER",
  "COURIER_PICKED_UP",
  "DELIVERING",
  "DELIVERED",
];

export function ProfilePage() {
  const session = useSession();
  const theme = useTheme();
  const ordersQuery = usePickerOrders();
  const orders = ordersQuery.data ?? [];

  const myStats = useMemo(() => {
    if (!session?.userId) return null;

    const myOrders = orders.filter((o) => o.pickerId === session.userId);
    const todayMy = myOrders.filter((o) => isToday(o.createdAt));
    const monthMy = myOrders.filter((o) => isThisMonth(o.createdAt));

    const todayAssembled = todayMy.filter((o) =>
      assembledStatuses.includes(o.status as OrderStatus)
    );
    const monthAssembled = monthMy.filter((o) =>
      assembledStatuses.includes(o.status as OrderStatus)
    );

    const monthRevenue = monthAssembled.reduce((sum, o) => sum + o.finalTotal, 0);

    return {
      todayAssembled: todayAssembled.length,
      monthAssembled: monthAssembled.length,
      totalMy: myOrders.length,
      monthRevenue,
    };
  }, [orders, session?.userId]);

  const roleLabel = session?.role === "PICKER" ? "Сборщик" : session?.role ?? "Неизвестно";

  return (
    <AppShell title="Профиль" subtitle="Информация о вашем аккаунте">
      {/* Profile card */}
      <div className="profile-card">
        <div className="profile-avatar">👤</div>
        <div className="profile-name">{roleLabel}</div>
        <div className="profile-meta">
          {session?.storeId
            ? `Магазин #${session.storeId.slice(0, 8).toUpperCase()}`
            : "Магазин не назначен"}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">🎨 Оформление</p>
        <div className="info-item">
          <span className="info-label">Тёмная тема</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={theme === "dark"}
              onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>

      {/* Notifications */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">🔔 Уведомления</p>
        <div className="info-list">
          <PushToggle />
        </div>
      </div>

      {/* Session details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="card-title">🪪 Данные сессии</p>
        <div className="info-list">
          <div className="info-item">
            <span className="info-label">Роль</span>
            <span className="info-value">{session?.role ?? "—"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">ID пользователя</span>
            <span className="info-value">
              {session?.userId ? session.userId.slice(0, 8).toUpperCase() : "—"}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">ID магазина</span>
            <span className="info-value">
              {session?.storeId ? session.storeId.slice(0, 8).toUpperCase() : "Не назначен"}
            </span>
          </div>
        </div>
      </div>

      {/* Personal stats */}
      <div className="card">
        <p className="card-title">📊 Моя статистика</p>
        {ordersQuery.isLoading ? (
          <p className="empty-text">Загрузка...</p>
        ) : myStats && myStats.totalMy > 0 ? (
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Собрано сегодня</span>
              <span className="info-value">{myStats.todayAssembled}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Собрано за месяц</span>
              <span className="info-value">{myStats.monthAssembled}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Всего обработано</span>
              <span className="info-value">{myStats.totalMy}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Товарооборот за месяц</span>
              <span className="info-value">{formatPrice(myStats.monthRevenue)}</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Нет данных</div>
            <div className="empty-state-sub">
              Статистика появится после обработки первых заказов
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
