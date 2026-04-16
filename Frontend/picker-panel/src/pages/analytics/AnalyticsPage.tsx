import { useMemo } from "react";
import { AppShell } from "../../shared/ui/AppShell";
import { usePickerOrders } from "../../features/orders/hooks";
import { formatPrice } from "../../shared/lib/format";
import { statusLabel, type OrderStatus } from "../../entities/order/model";

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

const deliveredStatuses: OrderStatus[] = [
  "DELIVERED",
  "ASSEMBLED",
  "WAITING_COURIER",
  "COURIER_PICKED_UP",
  "DELIVERING",
];

const activeStatuses: OrderStatus[] = [
  "NEW",
  "ACCEPTED_BY_PICKER",
  "ASSEMBLING",
  "ASSEMBLED",
  "NEEDS_CONFIRMATION",
  "WAITING_COURIER",
];

export function AnalyticsPage() {
  const ordersQuery = usePickerOrders();
  const orders = ordersQuery.data ?? [];

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    const monthOrders = orders.filter((o) => isThisMonth(o.createdAt));

    const todayCompleted = todayOrders.filter((o) =>
      deliveredStatuses.includes(o.status as OrderStatus)
    );
    const monthCompleted = monthOrders.filter((o) =>
      deliveredStatuses.includes(o.status as OrderStatus)
    );

    const todayRevenue = todayCompleted.reduce((sum, o) => sum + o.finalTotal, 0);
    const monthRevenue = monthCompleted.reduce((sum, o) => sum + o.finalTotal, 0);

    const todayCancelled = todayOrders.filter((o) => o.status === "CANCELLED").length;
    const monthCancelled = monthOrders.filter((o) => o.status === "CANCELLED").length;

    const currentlyActive = orders.filter((o) =>
      activeStatuses.includes(o.status as OrderStatus)
    ).length;

    // distribution by status across all today orders
    const statusCounts: Partial<Record<OrderStatus, number>> = {};
    for (const order of orders) {
      const s = order.status as OrderStatus;
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    }

    const maxCount = Math.max(...Object.values(statusCounts), 1);

    return {
      todayCount: todayOrders.length,
      todayRevenue,
      todayCancelled,
      monthCount: monthOrders.length,
      monthRevenue,
      monthCancelled,
      currentlyActive,
      totalCount: orders.length,
      statusCounts,
      maxCount,
    };
  }, [orders]);

  const statusBarItems: { status: OrderStatus; label: string }[] = [
    { status: "NEW", label: "Новые" },
    { status: "ACCEPTED_BY_PICKER", label: "Приняты" },
    { status: "ASSEMBLING", label: "В сборке" },
    { status: "ASSEMBLED", label: "Собраны" },
    { status: "NEEDS_CONFIRMATION", label: "Требует подтверждения" },
    { status: "WAITING_COURIER", label: "Ждут курьера" },
    { status: "DELIVERED", label: "Доставлены" },
    { status: "CANCELLED", label: "Отменены" },
  ];

  if (ordersQuery.isLoading) {
    return (
      <AppShell title="Аналитика" subtitle="Статистика работы магазина">
        <p className="empty-text">Загрузка данных...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Аналитика" subtitle="Статистика работы магазина">
      {/* Today */}
      <h2 className="section-title" style={{ marginBottom: 12 }}>Сегодня</h2>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="📦"
          color="indigo"
          value={stats.todayCount}
          label="Заказов принято"
        />
        <StatCard
          icon="✅"
          color="green"
          value={formatPrice(stats.todayRevenue)}
          label="Выручка"
        />
        <StatCard
          icon="⚡"
          color="blue"
          value={stats.currentlyActive}
          label="Активных сейчас"
        />
        <StatCard
          icon="❌"
          color="red"
          value={stats.todayCancelled}
          label="Отменено сегодня"
        />
      </div>

      {/* Month */}
      <h2 className="section-title" style={{ marginBottom: 12 }}>Этот месяц</h2>
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="📋"
          color="indigo"
          value={stats.monthCount}
          label="Заказов за месяц"
        />
        <StatCard
          icon="💰"
          color="green"
          value={formatPrice(stats.monthRevenue)}
          label="Выручка за месяц"
        />
        <StatCard
          icon="📊"
          color="yellow"
          value={stats.totalCount}
          label="Всего заказов"
        />
        <StatCard
          icon="🚫"
          color="red"
          value={stats.monthCancelled}
          label="Отменено за месяц"
        />
      </div>

      {/* Status breakdown */}
      <div className="analytics-grid">
        <div className="card">
          <p className="card-title">
            <span>📊</span> Распределение по статусам
          </p>
          {stats.totalCount === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">Данных пока нет</div>
            </div>
          ) : (
            <div className="chart-bar-list">
              {statusBarItems.map(({ status, label }) => {
                const count = stats.statusCounts[status] ?? 0;
                if (count === 0) return null;
                const pct = Math.round((count / stats.maxCount) * 100);
                return (
                  <div key={status} className="chart-bar-item">
                    <div className="chart-bar-label">
                      <span>{label}</span>
                      <span>{count}</span>
                    </div>
                    <div className="chart-bar-track">
                      <div
                        className="chart-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <p className="card-title">
            <span>💡</span> Коэффициенты
          </p>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Выполнено сегодня</span>
              <span className="info-value">
                {stats.todayCount > 0
                  ? `${Math.round(((stats.todayCount - stats.todayCancelled) / stats.todayCount) * 100)}%`
                  : "—"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Отмен за месяц</span>
              <span className="info-value">
                {stats.monthCount > 0
                  ? `${Math.round((stats.monthCancelled / stats.monthCount) * 100)}%`
                  : "—"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Средний чек (сегодня)</span>
              <span className="info-value">
                {stats.todayCount > 0
                  ? formatPrice(Math.round(stats.todayRevenue / stats.todayCount))
                  : "—"}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Средний чек (месяц)</span>
              <span className="info-value">
                {stats.monthCount > 0
                  ? formatPrice(Math.round(stats.monthRevenue / stats.monthCount))
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  color,
  value,
  label,
}: {
  icon: string;
  color: "indigo" | "green" | "yellow" | "red" | "blue";
  value: number | string;
  label: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon-wrap ${color}`}>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
