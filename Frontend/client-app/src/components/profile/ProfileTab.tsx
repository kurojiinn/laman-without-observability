"use client";

import { useEffect, useState } from "react";
import { ordersApi, type Order } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Маппинг статусов заказа в читаемые метки и цвета бейджей.
// Вынесен на уровень модуля (не внутрь компонента) — объект создаётся один раз,
// а не при каждом рендере. Это мелкая, но правильная привычка.
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
  onLogin: () => void;
}

export default function ProfileTab({ onLogin }: Props) {
  const { isAuthenticated, user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  // Загружаем заказы только для авторизованного пользователя.
  // Зависимость [isAuthenticated] гарантирует перезагрузку после входа/выхода.
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    ordersApi
      .getOrders({ limit: 50 })
      .then((res) => setOrders(res.data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  // Состояние для неавторизованного пользователя.
  // Показываем заглушку с кнопкой входа, а не пустой экран.
  // UX-правило: пустые состояния должны объяснять что делать дальше.
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-gray-700">Войдите в аккаунт</p>
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* ── Карточка профиля ── */}
      <ProfileCard
        phone={user?.phone ?? ""}
        role={user?.role ?? ""}
        id={user?.id ?? ""}
        onLogout={logout}
      />

      {/* ── История заказов ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">История заказов</h2>
        {loading ? (
          <OrderSkeleton />
        ) : orders.length === 0 ? (
          <EmptyOrders />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// ProfileCard — блок с информацией о пользователе
// =============================================================================

interface ProfileCardProps {
  phone: string;
  role: string;
  id: string;
  onLogout: () => void;
}

function ProfileCard({ phone, role, id, onLogout }: ProfileCardProps) {
  const roleLabel = role === "CLIENT" ? "Клиент" : role;

  // Инициалы для аватара — берём последние 2 цифры телефона.
  // Простой и надёжный способ когда нет имени пользователя.
  const initials = phone.slice(-2);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Шапка с аватаром */}
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{phone}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-white/20 text-white text-xs font-medium rounded-full">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Детали */}
      <div className="px-5 py-4 space-y-3">
        <InfoRow label="Телефон" value={phone} />
        <InfoRow label="ID аккаунта" value={`${id.slice(0, 8)}…`} mono />

        {/* Заглушка для баллов — будет реализовано в TASK-011 */}
        <div className="flex items-center justify-between py-2 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm text-gray-500">Баллы</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">Скоро</span>
        </div>
      </div>

      {/* Выход */}
      <div className="px-5 pb-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// OrderCard — карточка одного заказа
// =============================================================================

function OrderCard({ order }: { order: Order }) {
  const status = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };

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

// =============================================================================
// Вспомогательные компоненты
// =============================================================================

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs text-gray-700 font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-2xl h-24 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <span className="text-5xl mb-3">📦</span>
      <p className="text-sm text-gray-500">Заказов пока нет</p>
    </div>
  );
}
