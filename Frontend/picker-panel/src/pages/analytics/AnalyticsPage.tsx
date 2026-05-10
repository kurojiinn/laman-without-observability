import { useMemo, useState } from "react";
import { AppShell } from "../../shared/ui/AppShell";
import { usePickerOrders } from "../../features/orders/hooks";
import { useTopProducts } from "../../features/analytics/hooks";
import type { AnalyticsPeriod, TopProduct } from "../../features/analytics/api";
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

const activeStatuses: OrderStatus[] = [
  "NEW",
  "ACCEPTED_BY_PICKER",
  "ASSEMBLING",
  "NEEDS_CONFIRMATION",
];

export function AnalyticsPage() {
  const ordersQuery = usePickerOrders();
  const orders = ordersQuery.data ?? [];

  const stats = useMemo(() => {
    const todayOrders = orders.filter((o) => isToday(o.createdAt));
    const monthOrders = orders.filter((o) => isThisMonth(o.createdAt));

    const todayRevenue = todayOrders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + o.itemsTotal, 0);
    const monthRevenue = monthOrders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + o.itemsTotal, 0);

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
      <div className="card" style={{ marginBottom: 24 }}>
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

      {/* Top products */}
      <TopProductsSection />
    </AppShell>
  );
}

// ── Top Products ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "day",   label: "За день" },
  { value: "week",  label: "За неделю" },
  { value: "month", label: "За месяц" },
];

function TopProductsSection() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("day");
  const query = useTopProducts(period);
  const items = query.data ?? [];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <p className="card-title" style={{ margin: 0 }}>
          <span>🔥</span> Топ товаров
        </p>
        <div style={{ display: "flex", gap: 4, background: "#f3f4f6", padding: 4, borderRadius: 8 }}>
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = period === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                style={{
                  border: "none",
                  background: isActive ? "#fff" : "transparent",
                  color: isActive ? "#111" : "#6b7280",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {query.isLoading ? (
        <p className="empty-text">Загрузка...</p>
      ) : query.isError ? (
        <p className="error-text">Не удалось загрузить топ товаров</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">Продаж за период нет</div>
        </div>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Товар</th>
              <th style={{ textAlign: "right" }}>Шт.</th>
              <th style={{ textAlign: "right" }}>Выручка</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, idx) => <TopProductRow key={p.name} rank={idx + 1} product={p} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}

function TopProductRow({ rank, product }: { rank: number; product: TopProduct }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}`;
  return (
    <tr>
      <td style={{ fontWeight: 600, fontSize: 16 }}>{medal}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: 36, height: 36, background: "#f0f0f0", borderRadius: 6, flexShrink: 0 }} />
          )}
          <span>{product.name}</span>
        </div>
      </td>
      <td style={{ textAlign: "right", fontWeight: 600 }}>{product.totalQty}</td>
      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatPrice(product.totalRevenue)}</td>
    </tr>
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
