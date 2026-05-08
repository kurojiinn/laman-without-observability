"use client";

import { useOrderNotification } from "@/context/OrderNotificationContext";

export default function OrderUpdateModal() {
  const { notification, dismiss, openOrder } = useOrderNotification();

  if (!notification) return null;

  function handleOpenOrder() {
    if (!notification) return;
    openOrder(notification.orderId);
    dismiss();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="relative w-full sm:max-w-sm sm:mx-6 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Иконка */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 mx-auto mb-4">
          <span className="text-2xl">🛒</span>
        </div>

        {/* Заголовок */}
        <h2 className="text-center text-lg font-bold text-gray-900 mb-2">
          Заказ изменён
        </h2>

        {/* Сообщение */}
        <p className="text-center text-sm text-gray-600 mb-5">
          {notification.message}
        </p>

        {/* Новая сумма */}
        <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 mb-5">
          <span className="text-sm text-gray-500">Итого к оплате</span>
          <span className="text-base font-bold text-gray-900">
            {notification.finalTotal.toLocaleString("ru-RU")} ₽
          </span>
        </div>

        {/* Кнопки */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleOpenOrder}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl transition-colors"
          >
            Открыть заказ
          </button>
          <button
            onClick={dismiss}
            className="w-full py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-2xl hover:bg-gray-50 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
