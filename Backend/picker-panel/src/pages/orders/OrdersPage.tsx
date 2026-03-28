import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../shared/ui/AppShell";
import { usePickerOrders } from "../../features/orders/hooks";
import { usePickerRealtime } from "../../features/sse/usePickerRealtime";
import { shortId, formatDate, formatPrice } from "../../shared/lib/format";
import { statusLabel, statusPriority } from "../../entities/order/model";

type FilterType = "all" | "new" | "assembling" | "problem";

export function OrdersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const ordersQuery = usePickerOrders();
  usePickerRealtime(true);

  const orders = useMemo(() => {
    const items = [...(ordersQuery.data ?? [])];
    items.sort((a, b) => {
      const byPriority = statusPriority(a.status) - statusPriority(b.status);
      if (byPriority !== 0) return byPriority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return items.filter((order) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        q === "" ||
        order.id.toLowerCase().includes(q) ||
        (order.guestPhone ?? "").toLowerCase().includes(q);

      const matchesFilter =
        filter === "all" ||
        (filter === "new" && order.status === "NEW") ||
        (filter === "assembling" &&
          ["ACCEPTED_BY_PICKER", "ASSEMBLING", "NEEDS_CONFIRMATION"].includes(order.status)) ||
        (filter === "problem" && order.status === "NEEDS_CONFIRMATION");

      return matchesQuery && matchesFilter;
    });
  }, [ordersQuery.data, query, filter]);

  return (
    <AppShell title="Очередь заказов">
      <section className="card controls">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по ID или телефону"
        />
        <div className="segmented">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
            Все
          </button>
          <button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>
            Новые
          </button>
          <button
            className={filter === "assembling" ? "active" : ""}
            onClick={() => setFilter("assembling")}
          >
            В сборке
          </button>
          <button
            className={filter === "problem" ? "active" : ""}
            onClick={() => setFilter("problem")}
          >
            Проблемные
          </button>
        </div>
      </section>

      <section className="card">
        {ordersQuery.isLoading ? <p>Загрузка заказов...</p> : null}
        {ordersQuery.isError ? (
          <p className="error-text">
            {ordersQuery.error instanceof Error ? ordersQuery.error.message : "Ошибка загрузки"}
          </p>
        ) : null}
        {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 ? (
          <p className="empty-text">Нет заказов по текущему фильтру</p>
        ) : null}

        {orders.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Сумма</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{shortId(order.id)}</td>
                  <td>{order.guestName ?? "Гость"}</td>
                  <td>{order.guestPhone ?? "-"}</td>
                  <td>{statusLabel(order.status)}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>{formatPrice(order.finalTotal)}</td>
                  <td>
                    <Link to={`/orders/${order.id}`}>Открыть</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </AppShell>
  );
}
