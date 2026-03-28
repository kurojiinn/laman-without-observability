import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../../shared/ui/AppShell";
import { usePickerOrder, useUpdateOrderStatus } from "../../features/orders/hooks";
import { formatDate, formatPrice, shortId } from "../../shared/lib/format";
import { getPickerActions, statusLabel } from "../../entities/order/model";

export function OrderDetailsPage() {
  const { id = "" } = useParams();
  const orderQuery = usePickerOrder(id);
  const mutation = useUpdateOrderStatus(id);

  const actions = useMemo(() => {
    if (!orderQuery.data) return [];
    return getPickerActions(orderQuery.data.status);
  }, [orderQuery.data]);

  return (
    <AppShell title={`Заказ #${shortId(id)}`}>
      <p>
        <Link to="/orders">← Назад к очереди</Link>
      </p>

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
                <strong>Клиент:</strong> {orderQuery.data.guestName ?? "Гость"}
              </p>
              <p>
                <strong>Телефон:</strong> {orderQuery.data.guestPhone ?? "-"}
              </p>
              <p>
                <strong>Адрес:</strong> {orderQuery.data.guestAddress ?? "-"}
              </p>
              <p>
                <strong>Комментарий:</strong> {orderQuery.data.comment ?? "-"}
              </p>
              <p>
                <strong>Создан:</strong> {formatDate(orderQuery.data.createdAt)}
              </p>
            </div>
            <div>
              <h2>Финансы</h2>
              <p>
                <strong>Товары:</strong> {formatPrice(orderQuery.data.itemsTotal)}
              </p>
              <p>
                <strong>Сервисный сбор:</strong> {formatPrice(orderQuery.data.serviceFee)}
              </p>
              <p>
                <strong>Доставка:</strong> {formatPrice(orderQuery.data.deliveryFee)}
              </p>
              <p>
                <strong>Итого:</strong> {formatPrice(orderQuery.data.finalTotal)}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Действия сборщика</h2>
        {actions.length === 0 ? <p className="empty-text">Нет доступных действий</p> : null}
        <div className="actions">
          {actions.map((status) => (
            <button
              key={status}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(status)}
              type="button"
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
