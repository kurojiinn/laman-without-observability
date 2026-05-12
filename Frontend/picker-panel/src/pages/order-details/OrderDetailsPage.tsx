import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../shared/ui/AppShell";
import {
  usePickerOrder,
  useUpdateOrderStatus,
  useAddOrderItem,
  useRemoveOrderItem,
} from "../../features/orders/hooks";
import { formatDate, formatPrice, shortId } from "../../shared/lib/format";
import { getPickerActions, statusLabel, outOfStockLabel, type DeliveryType } from "../../entities/order/model";

export function OrderDetailsPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const orderQuery = usePickerOrder(id);
  const mutation = useUpdateOrderStatus(id);
  const addItem = useAddOrderItem(id);
  const removeItem = useRemoveOrderItem(id);

  const [editing, setEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newQty, setNewQty] = useState("1");

  const actions = useMemo(() => {
    if (!orderQuery.data) return [];
    return getPickerActions(orderQuery.data.status);
  }, [orderQuery.data]);

  function handleAdd() {
    const price = parseFloat(newPrice);
    const quantity = parseInt(newQty, 10);
    if (!newName.trim() || isNaN(price) || price <= 0 || isNaN(quantity) || quantity <= 0) return;

    addItem.mutate(
      { product_name: newName.trim(), price, quantity },
      {
        onSuccess: () => {
          setNewName("");
          setNewPrice("");
          setNewQty("1");
          setShowAddForm(false);
        },
      },
    );
  }

  function handleRemove(itemId: string) {
    removeItem.mutate(itemId);
  }

  const isPending = addItem.isPending || removeItem.isPending;

  return (
    <AppShell title={`Заказ #${shortId(id)}`} subtitle="Детали и управление заказом">
      <button className="back-btn" type="button" onClick={() => navigate("/orders")}>
        ← Назад к очереди
      </button>

      <section className="card">
        {orderQuery.isLoading ? <p>Загрузка заказа...</p> : null}
        {orderQuery.isError ? (
          <p className="error-text">
            {orderQuery.error instanceof Error ? orderQuery.error.message : "Ошибка загрузки"}
          </p>
        ) : null}

        {orderQuery.data ? (
          <div className="order-grid">
            <div>
              <h2>Детали</h2>
              <p>
                <strong>Статус:</strong> {statusLabel(orderQuery.data.status)}
              </p>
              <p>
                <strong>Телефон:</strong> {orderQuery.data.customerPhone ?? orderQuery.data.guestPhone ?? "-"}
              </p>
              <p>
                <strong>Адрес:</strong> {orderQuery.data.deliveryAddress ?? orderQuery.data.guestAddress ?? "-"}
              </p>
              <p>
                <strong>Комментарий:</strong> {orderQuery.data.comment ?? "-"}
              </p>
              <p>
                <strong>Время доставки:</strong>{" "}
                <DeliveryBadge
                  type={orderQuery.data.deliveryType}
                  scheduledAt={orderQuery.data.scheduledAt}
                  surcharge={orderQuery.data.deliverySurcharge}
                />
              </p>
              <p>
                <strong>Если товара нет:</strong>{" "}
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      orderQuery.data.outOfStockAction === "CALL"
                        ? "#fef3c7"
                        : orderQuery.data.outOfStockAction === "REPLACE"
                        ? "#dbeafe"
                        : "#f3f4f6",
                    color:
                      orderQuery.data.outOfStockAction === "CALL"
                        ? "#92400e"
                        : orderQuery.data.outOfStockAction === "REPLACE"
                        ? "#1e40af"
                        : "#374151",
                  }}
                >
                  {orderQuery.data.outOfStockAction === "CALL" && "📞 "}
                  {orderQuery.data.outOfStockAction === "REPLACE" && "🔄 "}
                  {orderQuery.data.outOfStockAction === "REMOVE" && "🗑️ "}
                  {outOfStockLabel(orderQuery.data.outOfStockAction)}
                </span>
              </p>
              <p>
                <strong>Создан:</strong> {formatDate(orderQuery.data.createdAt)}
              </p>
            </div>
            <div>
              <h2>Финансы</h2>
              <p>
                <strong>Сумма заказа:</strong> {formatPrice(orderQuery.data.itemsTotal)}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Состав заказа</h2>
          {orderQuery.data ? (
            <button
              type="button"
              onClick={() => {
                setEditing(!editing);
                setShowAddForm(false);
              }}
              style={{
                background: editing ? "#6b7280" : "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "6px 16px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {editing ? "Готово" : "Изменить заказ"}
            </button>
          ) : null}
        </div>

        {editing ? (
          <div style={{ margin: "12px 0" }}>
            {showAddForm ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 2 }}>Название</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Молоко 3.2%"
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", width: 180 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 2 }}>Цена</label>
                  <input
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0"
                    type="number"
                    min="1"
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", width: 90 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 2 }}>Кол-во</label>
                  <input
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    type="number"
                    min="1"
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", width: 60 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isPending}
                  style={{
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{
                    background: "#e5e7eb",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                style={{
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                + Добавить товар
              </button>
            )}
          </div>
        ) : null}

        {orderQuery.isLoading ? null : orderQuery.data?.items.length === 0 ? (
          <p className="empty-text">Товары не найдены</p>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Фото</th>
                <th>Товар</th>
                <th>Кол-во</th>
                <th>Цена</th>
                <th>Сумма</th>
                {editing ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {orderQuery.data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }}
                      />
                    ) : (
                      <div style={{ width: 56, height: 56, background: "#f0f0f0", borderRadius: 6 }} />
                    )}
                  </td>
                  <td>
                    {item.productName}
                    {item.options.length > 0 && (
                      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                        {item.options.map((o, idx) => (
                          <div key={idx}>
                            <strong>{o.groupName}:</strong> {o.valueName}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.price)}</td>
                  <td>{formatPrice(item.price * item.quantity)}</td>
                  {editing ? (
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        disabled={isPending}
                        title="Удалить товар"
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          padding: "6px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 16,
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(addItem.isError || removeItem.isError) ? (
          <p className="error-text">Ошибка изменения заказа</p>
        ) : null}
      </section>

      <section className="card">
        <p className="card-title">⚡ Действия сборщика</p>
        {actions.length === 0 ? <p className="empty-text">Нет доступных действий</p> : null}
        <div className="actions">
          {actions.map((status) => (
            <button
              key={status}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(status)}
              type="button"
              className={status === "CANCELLED" ? "btn-danger" : "btn-primary"}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
        {mutation.isError ? (
          <p className="error-text">
            {mutation.error instanceof Error ? mutation.error.message : "Ошибка обновления"}
          </p>
        ) : null}
        {mutation.isSuccess ? <p className="success-text">Статус обновлен</p> : null}
      </section>
    </AppShell>
  );
}

function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleString("ru-RU", { day: "numeric", month: "long" });
  const time = d.toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${day} в ${time}`;
}

function DeliveryBadge({
  type,
  scheduledAt,
  surcharge,
}: {
  type: DeliveryType | null | undefined;
  scheduledAt: string | null | undefined;
  surcharge: number | undefined;
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
  };
  if (type === "express") {
    return (
      <span style={{ ...baseStyle, background: "#fee2e2", color: "#991b1b" }}>
        ⚡ Срочная доставка{surcharge ? ` (+${surcharge} ₽)` : ""}
      </span>
    );
  }
  if (type === "scheduled" && scheduledAt) {
    return (
      <span style={{ ...baseStyle, background: "#dcfce7", color: "#166534" }}>
        🕕 {formatScheduledAt(scheduledAt)}
      </span>
    );
  }
  return (
    <span style={{ ...baseStyle, background: "#f3f4f6", color: "#374151" }}>
      Как можно скорее
    </span>
  );
}
