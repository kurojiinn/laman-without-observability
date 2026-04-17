import { useQuery } from "@tanstack/react-query";
import { fetchDashboardStats, fetchAllOrders } from "../api/admin";
import { PageHeader, Card } from "../components/Layout";
import type { AdminOrder, OrderStatus } from "../types";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "../types";

interface Props { user: string; password: string; }

function StatCard({ title, value, sub, icon, color }: { title: string; value: string | number; sub?: string; icon: string; color: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function DashboardPage({ user, password }: Props) {
  const statsQ = useQuery({
    queryKey: ["stats", user],
    queryFn: () => fetchDashboardStats(user, password),
    refetchInterval: 30_000,
  });

  const ordersQ = useQuery<AdminOrder[]>({
    queryKey: ["all-orders", user],
    queryFn: () => fetchAllOrders(user, password),
    refetchInterval: 15_000,
  });

  const activeOrders = (ordersQ.data ?? []).filter((o) =>
    !["DELIVERED", "CANCELLED"].includes(o.status)
  );

  const stats = statsQ.data;

  return (
    <div className="p-6">
      <PageHeader
        title="Дашборд"
        subtitle="Обзор текущего состояния системы"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Пользователей"
          value={stats?.total_registered_users ?? "—"}
          icon="👤"
          color="bg-blue-50"
        />
        <StatCard
          title="Активные заказы"
          value={stats?.active_orders_count ?? "—"}
          sub="сейчас в работе"
          icon="📋"
          color="bg-amber-50"
        />
        <StatCard
          title="Выручка сегодня"
          value={stats ? `${stats.today_revenue.toLocaleString("ru-RU")} ₽` : "—"}
          icon="💰"
          color="bg-emerald-50"
        />
        <StatCard
          title="Гостей"
          value={stats?.total_guests ?? "—"}
          icon="👥"
          color="bg-purple-50"
        />
      </div>

      {/* Active orders preview */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Активные заказы</h2>
          {!ordersQ.isLoading && (
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
              {activeOrders.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {ordersQ.isLoading ? (
            <div className="flex items-center gap-2 px-5 py-6 text-gray-400 text-sm">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12"/></svg>
              Загрузка...
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-sm">Активных заказов нет</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">Заказ</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3">Телефон</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3">Сумма</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3">Статус</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-3 py-3">Создан</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.slice(0, 10).map((order) => (
                  <tr key={order.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{order.id.slice(0, 8)}…</td>
                    <td className="px-3 py-3 text-gray-700">{order.customer_phone ?? "—"}</td>
                    <td className="px-3 py-3 font-semibold text-gray-900">{order.final_total.toLocaleString("ru-RU")} ₽</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLORS[order.status as OrderStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs">
                      {new Date(order.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
