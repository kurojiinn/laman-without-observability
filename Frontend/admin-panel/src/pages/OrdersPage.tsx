import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllOrders, updateOrderStatusAdmin } from "../api/admin";
import { PageHeader, Card, Btn } from "../components/Layout";
import type { AdminOrder, OrderStatus } from "../types";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "../types";

interface Props { user: string; password: string; }

type StatusFilter = "all" | "active" | "DELIVERED" | "CANCELLED";

const ACTIVE_STATUSES = new Set([
  "NEW", "ACCEPTED_BY_PICKER", "ASSEMBLING", "ASSEMBLED",
  "NEEDS_CONFIRMATION", "WAITING_COURIER", "COURIER_PICKED_UP", "DELIVERING",
]);

const STATUS_ACTIONS: { label: string; status: string; variant: "ghost" | "secondary" | "danger" }[] = [
  { label: "Принят", status: "ACCEPTED_BY_PICKER", variant: "ghost" },
  { label: "Собирается", status: "ASSEMBLING", variant: "ghost" },
  { label: "Собран", status: "ASSEMBLED", variant: "ghost" },
  { label: "Ждёт курьера", status: "WAITING_COURIER", variant: "ghost" },
  { label: "Курьер взял", status: "COURIER_PICKED_UP", variant: "ghost" },
  { label: "Доставлен", status: "DELIVERED", variant: "secondary" },
  { label: "Отменить", status: "CANCELLED", variant: "danger" },
];

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "DELIVERED", label: "Доставлены" },
  { value: "CANCELLED", label: "Отменены" },
];

export function OrdersPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("active");

  const ordersQ = useQuery<AdminOrder[]>({
    queryKey: ["all-orders", user],
    queryFn: () => fetchAllOrders(user, password),
    refetchInterval: 15_000,
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateOrderStatusAdmin(user, password, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-orders"] }),
  });

  const allOrders = ordersQ.data ?? [];

  const filtered = allOrders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return ACTIVE_STATUSES.has(o.status);
    return o.status === filter;
  });

  const activeCount = allOrders.filter((o) => ACTIVE_STATUSES.has(o.status)).length;

  return (
    <div className="p-6">
      <PageHeader
        title="Заказы"
        subtitle={`Активных: ${activeCount} · Всего за 90 дней: ${allOrders.length}`}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const count = tab.value === "all"
            ? allOrders.length
            : tab.value === "active"
            ? allOrders.filter((o) => ACTIVE_STATUSES.has(o.status)).length
            : allOrders.filter((o) => o.status === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab.value
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-indigo-300"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  filter === tab.value ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card>
        {ordersQ.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-gray-400 text-sm justify-center">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
            Загрузка...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm font-medium">Заказов нет</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onStatus={(status) => statusMut.mutate({ id: order.id, status })}
                isPending={statusMut.isPending}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function OrderRow({
  order,
  onStatus,
  isPending,
}: {
  order: AdminOrder;
  onStatus: (s: string) => void;
  isPending: boolean;
}) {
  const statusColor = ORDER_STATUS_COLORS[order.status as OrderStatus] ?? "bg-gray-100 text-gray-600";
  const statusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{order.id.slice(0, 8)}…</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="font-bold text-gray-900">{order.final_total.toLocaleString("ru-RU")} ₽</span>
          </div>
          <div className="mt-1.5 flex gap-4 text-xs text-gray-500 flex-wrap">
            <span>📞 {order.customer_phone ?? "—"}</span>
            {order.delivery_address && <span>📍 {order.delivery_address}</span>}
            <span>
              {new Date(order.created_at).toLocaleString("ru-RU", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
          {order.items && order.items.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {order.items.map((item, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {item.product_name} × {item.quantity}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 flex-shrink-0">
          {STATUS_ACTIONS.map(({ label, status, variant }) => (
            <Btn
              key={status}
              size="sm"
              variant={variant}
              disabled={isPending || order.status === status}
              onClick={() => onStatus(status)}
            >
              {label}
            </Btn>
          ))}
        </div>
      </div>
    </div>
  );
}
