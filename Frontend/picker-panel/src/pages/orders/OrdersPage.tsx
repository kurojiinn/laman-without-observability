"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../../shared/ui/AppShell";
import { usePickerOrders } from "../../features/orders/hooks";
import { usePickerRealtime } from "../../features/sse/usePickerRealtime";
import { playNewOrderSound, playCancelSound } from "../../features/sse/audio";
import { formatDate, formatPrice } from "../../shared/lib/format";
import { statusLabel, statusPriority, type PickerOrder, type OrderStatus } from "../../entities/order/model";

type CompletedSort = "date_desc" | "date_asc" | "price_desc" | "price_asc";
type CompletedStatusFilter = "all" | "DELIVERED" | "CANCELLED" | "DELIVERING" | "WAITING_COURIER";

type CancelledNotification = {
  orderId: string;
  customerPhone: string;
};

const completedStatuses = new Set([
  "ASSEMBLED",
  "WAITING_COURIER",
  "COURIER_PICKED_UP",
  "DELIVERING",
  "DELIVERED",
  "CANCELLED",
]);

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "NEW":                return "status-badge status-new";
    case "ACCEPTED_BY_PICKER": return "status-badge status-accepted";
    case "ASSEMBLING":         return "status-badge status-assembling";
    case "ASSEMBLED":          return "status-badge status-assembled";
    case "WAITING_COURIER":    return "status-badge status-waiting";
    case "COURIER_PICKED_UP":  return "status-badge status-picked";
    case "DELIVERING":         return "status-badge status-delivering";
    case "DELIVERED":          return "status-badge status-delivered";
    case "CANCELLED":          return "status-badge status-cancelled";
    case "NEEDS_CONFIRMATION": return "status-badge status-problem";
    default:                   return "status-badge";
  }
}

export function OrdersPage() {
  const [query, setQuery] = useState("");
  const [completedSort, setCompletedSort] = useState<CompletedSort>("date_desc");
  const [completedStatusFilter, setCompletedStatusFilter] = useState<CompletedStatusFilter>("all");
  const [cancelled, setCancelled] = useState<CancelledNotification | null>(null);
  const ordersQuery = usePickerOrders();
  const navigate = useNavigate();
  usePickerRealtime(true);

  const prevStatusMapRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const orders: PickerOrder[] = ordersQuery.data ?? [];
    if (!ordersQuery.isSuccess) return;

    const currentMap = new Map(orders.map((o) => [o.id, o.status]));
    const prev = prevStatusMapRef.current;

    if (prev !== null) {
      for (const id of currentMap.keys()) {
        if (!prev.has(id)) {
          playNewOrderSound();
          break;
        }
      }

      for (const [id, status] of currentMap) {
        const prevStatus = prev.get(id);
        if (status === "CANCELLED" && prevStatus && prevStatus !== "CANCELLED") {
          const order = orders.find((o) => o.id === id);
          playCancelSound();
          setCancelled({
            orderId: id,
            customerPhone: order?.customerPhone ?? order?.guestPhone ?? "",
          });
          break;
        }
      }
    }

    prevStatusMapRef.current = currentMap;
  }, [ordersQuery.data, ordersQuery.isSuccess]);

  const filteredOrders = useMemo(() => {
    const items = [...(ordersQuery.data ?? [])];
    items.sort((a, b) => {
      const byPriority = statusPriority(a.status) - statusPriority(b.status);
      if (byPriority !== 0) return byPriority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return items.filter((order) => {
      const q = query.trim().toLowerCase();
      return (
        q === "" ||
        order.id.toLowerCase().includes(q) ||
        (order.customerPhone ?? order.guestPhone ?? "").toLowerCase().includes(q)
      );
    });
  }, [ordersQuery.data, query]);

  const activeOrders = useMemo(
    () => filteredOrders.filter((order) => !completedStatuses.has(order.status)),
    [filteredOrders],
  );
  const completedOrders = useMemo(() => {
    let items = filteredOrders.filter((order) => completedStatuses.has(order.status));

    if (completedStatusFilter !== "all") {
      items = items.filter((o) => o.status === completedStatusFilter);
    }

    items = [...items].sort((a, b) => {
      switch (completedSort) {
        case "date_desc": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date_asc":  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "price_desc": return b.finalTotal - a.finalTotal;
        case "price_asc":  return a.finalTotal - b.finalTotal;
      }
    });

    return items;
  }, [filteredOrders, completedSort, completedStatusFilter]);

  return (
    <AppShell
      title="Очередь заказов"
      subtitle="Все заказы вашего магазина"
    >
      {/* Cancel popup */}
      {cancelled && (
        <div className="alert-overlay" onClick={dismissIfClickedOutside}>
          <div className="alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className="alert-icon">✕</div>
            <h2 className="alert-title">Заказ отменён</h2>
            <p className="alert-order-id">
              ID: <span>{cancelled.orderId.slice(0, 8).toUpperCase()}</span>
            </p>
            {cancelled.customerPhone && (
              <p className="alert-phone">
                Клиент: <span>{cancelled.customerPhone}</span>
              </p>
            )}
            <p className="alert-message">Клиент отменил заказ. Верните товары на полки.</p>
            <button className="alert-btn btn-danger" onClick={() => setCancelled(null)}>
              Понял
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ID или телефону..."
        />
      </div>

      {/* Active orders */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">Активные заказы</span>
          {activeOrders.length > 0 && (
            <span className="section-count">{activeOrders.length}</span>
          )}
        </div>

        {ordersQuery.isLoading && <p className="empty-text">Загрузка заказов...</p>}
        {ordersQuery.isError && (
          <p className="error-text">
            {ordersQuery.error instanceof Error ? ordersQuery.error.message : "Ошибка загрузки"}
          </p>
        )}
        {!ordersQuery.isLoading && !ordersQuery.isError && activeOrders.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">Активных заказов нет</div>
            <div className="empty-state-sub">Новые заказы появятся автоматически</div>
          </div>
        )}

        {activeOrders.length > 0 && (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => (
                <tr
                  key={order.id}
                  className="clickable-row"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <td>{order.customerPhone ?? order.guestPhone ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <span className={statusBadgeClass(order.status as OrderStatus)}>
                        {statusLabel(order.status)}
                      </span>
                      <DeliveryInline
                        type={order.deliveryType}
                        scheduledAt={order.scheduledAt}
                      />
                    </div>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td style={{ fontWeight: 600 }}>{formatPrice(order.finalTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Completed orders */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">Выполненные</span>
          {completedOrders.length > 0 && (
            <span className="section-count">{completedOrders.length}</span>
          )}
        </div>

        <div className="completed-filters">
          <div className="completed-filters-row">
            <label className="completed-filters-label" htmlFor="completed-status">Статус</label>
            <select
              id="completed-status"
              className="filter-select"
              value={completedStatusFilter}
              onChange={(e) => setCompletedStatusFilter(e.target.value as CompletedStatusFilter)}
            >
              <option value="all">Все статусы</option>
              <option value="DELIVERED">Доставлен</option>
              <option value="CANCELLED">Отменён</option>
              <option value="DELIVERING">В пути</option>
              <option value="WAITING_COURIER">Ждёт курьера</option>
            </select>
          </div>

          <div className="completed-filters-row">
            <label className="completed-filters-label" htmlFor="completed-sort">Сортировка</label>
            <select
              id="completed-sort"
              className="filter-select"
              value={completedSort}
              onChange={(e) => setCompletedSort(e.target.value as CompletedSort)}
            >
              <option value="date_desc">Сначала новые</option>
              <option value="date_asc">Сначала старые</option>
              <option value="price_desc">Сначала дорогие</option>
              <option value="price_asc">Сначала дешёвые</option>
            </select>
          </div>
        </div>

        {completedOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Нет выполненных заказов</div>
          </div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {completedOrders.map((order) => (
                <tr
                  key={order.id}
                  className="clickable-row"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <td style={{ color: "var(--text-secondary)" }}>
                    {order.customerPhone ?? order.guestPhone ?? "—"}
                  </td>
                  <td>
                    <span className={statusBadgeClass(order.status as OrderStatus)}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)" }}>{formatDate(order.createdAt)}</td>
                  <td style={{ fontWeight: 600 }}>{formatPrice(order.finalTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );

  function dismissIfClickedOutside() {
    setCancelled(null);
  }
}

function DeliveryInline({
  type,
  scheduledAt,
}: {
  type?: PickerOrder["deliveryType"];
  scheduledAt?: string | null;
}) {
  if (type === "express") {
    return (
      <span
        style={{
          display: "inline-block",
          padding: "1px 6px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 4,
          background: "#fee2e2",
          color: "#991b1b",
        }}
      >
        ⚡ Срочно
      </span>
    );
  }
  if (type === "scheduled" && scheduledAt) {
    const d = new Date(scheduledAt);
    const day = d.toLocaleString("ru-RU", { day: "numeric", month: "short" });
    const time = d.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return (
      <span
        style={{
          display: "inline-block",
          padding: "1px 6px",
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 4,
          background: "#dcfce7",
          color: "#166534",
        }}
      >
        🕕 {day} в {time}
      </span>
    );
  }
  return null;
}
