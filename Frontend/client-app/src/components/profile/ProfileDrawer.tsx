"use client";

import { useEffect, useState } from "react";
import { ordersApi, type Order } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW:                { label: "Новый",           color: "bg-blue-100 text-blue-700" },
  ACCEPTED_BY_PICKER: { label: "Принят",          color: "bg-indigo-100 text-indigo-700" },
  ASSEMBLING:         { label: "Собирается",      color: "bg-yellow-100 text-yellow-700" },
  ASSEMBLED:          { label: "Собран",          color: "bg-orange-100 text-orange-700" },
  WAITING_COURIER:    { label: "Ждёт курьера",    color: "bg-purple-100 text-purple-700" },
  COURIER_PICKED_UP:  { label: "Курьер забрал",   color: "bg-indigo-100 text-indigo-700" },
  DELIVERING:         { label: "В пути",          color: "bg-blue-100 text-blue-700" },
  DELIVERED:          { label: "Доставлен",       color: "bg-green-100 text-green-700" },
  CANCELLED:          { label: "Отменён",         color: "bg-red-100 text-red-700" },
  NEEDS_CONFIRMATION: { label: "Нужно уточнение", color: "bg-yellow-100 text-yellow-700" },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ open, onClose }: Props) {
  const { isAuthenticated, user, logout, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  // Загружаем заказы когда drawer открывается и пользователь авторизован
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    setLoading(true);
    ordersApi
      .getOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [open, isAuthenticated]);

  // Блокируем скролл страницы пока drawer открыт
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function handleLogout() {
    logout();
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Затемнение фона — клик закрывает drawer */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Сам drawer — справа на десктопе, снизу на мобильном */}
      <div className="fixed z-50 bg-white shadow-2xl flex flex-col
        inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh]
        sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:rounded-none sm:max-h-full">

        {/* Шапка drawer */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Личный кабинет</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Контент — скроллится */}
        <div className="flex-1 overflow-y-auto">
          {!isAuthenticated ? (
            <NotAuthorized onLogin={() => { onClose(); openAuthModal(); }} />
          ) : (
            <div className="px-5 py-4 space-y-5">
              <UserCard phone={user?.phone ?? ""} role={user?.role ?? ""} id={user?.id ?? ""} />
              <OrderHistory orders={orders} loading={loading} />
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                </svg>
                Выйти из аккаунта
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function UserCard({ phone, role, id }: { phone: string; role: string; id: string }) {
  return (
    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold">{phone.slice(-2)}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{phone}</p>
          <span className="inline-block mt-0.5 px-2 py-0.5 bg-white/20 text-xs font-medium rounded-full">
            {role === "CLIENT" ? "Клиент" : role}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
        <span className="text-xs text-white/70">ID: {id.slice(0, 8)}…</span>
        {/* Место под баллы — TASK-011 */}
        <div className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-xs text-white/70">Баллы — скоро</span>
        </div>
      </div>
    </div>
  );
}

function OrderHistory({ orders, loading }: { orders: Order[]; loading: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">История заказов</h3>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-gray-400">
          <span className="text-4xl mb-2">📦</span>
          <p className="text-sm">Заказов пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const status = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
  const date = new Date(order.created_at).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="bg-gray-50 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-400">{date}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${status.color}`}>
          {status.label}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
        <span className="text-xs text-gray-500">{order.payment_method}</span>
        <span className="text-sm font-bold text-gray-900">
          {order.final_total.toLocaleString("ru-RU")} ₽
        </span>
      </div>
    </div>
  );
}

function NotAuthorized({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 gap-4">
      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="font-semibold text-gray-800">Войдите в аккаунт</p>
        <p className="text-sm text-gray-400 mt-1">Чтобы видеть профиль и историю заказов</p>
      </div>
      <button
        onClick={onLogin}
        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Войти
      </button>
    </div>
  );
}
