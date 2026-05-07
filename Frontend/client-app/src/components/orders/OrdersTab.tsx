"use client";

import { useEffect, useState } from "react";
import { ordersApi, type Order } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW:                { label: "Новый",             color: "bg-blue-100 text-blue-700" },
  ACCEPTED_BY_PICKER: { label: "Принят",            color: "bg-indigo-100 text-indigo-700" },
  ASSEMBLING:         { label: "Собирается",        color: "bg-yellow-100 text-yellow-700" },
  ASSEMBLED:          { label: "Собран",            color: "bg-orange-100 text-orange-700" },
  WAITING_COURIER:    { label: "Ждёт курьера",      color: "bg-purple-100 text-purple-700" },
  COURIER_PICKED_UP:  { label: "Курьер забрал",     color: "bg-indigo-100 text-indigo-700" },
  DELIVERING:         { label: "В пути",            color: "bg-blue-100 text-blue-700" },
  DELIVERED:          { label: "Доставлен",         color: "bg-green-100 text-green-700" },
  CANCELLED:          { label: "Отменён",           color: "bg-red-100 text-red-700" },
  NEEDS_CONFIRMATION: { label: "Нужно уточнение",   color: "bg-yellow-100 text-yellow-700" },
};

export default function OrdersTab() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    ordersApi
      .getOrders({ limit: 50 })
      .then((res) => setOrders(res.data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">📋</span>
        <p className="text-base font-medium text-gray-500">Войдите, чтобы видеть заказы</p>
        <button
          onClick={openAuthModal}
          className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Войти
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">📦</span>
        <p className="text-base font-medium text-gray-500">Заказов пока нет</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const status = STATUS_META[order.status] ?? {
    label: order.status,
    color: "bg-gray-100 text-gray-600",
  };

  const date = new Date(order.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">{date}</p>
          <p className="text-sm font-semibold text-gray-900">
            Заказ #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-sm">
        <span className="text-gray-500">{order.payment_method}</span>
        <span className="font-bold text-gray-900">
          {order.final_total.toLocaleString("ru-RU")} ₽
        </span>
      </div>
    </div>
  );
}
