"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBodyScrollLockWhen } from "@/hooks/useBodyScrollLock";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { ordersApi, catalogApi, usersApi, type Order, type OrderItem, type UserProfile } from "@/lib/api";
import { useOrders, useProfile, queryKeys } from "@/lib/queries";
import { OrderCardSkeleton } from "@/components/ui/Skeleton";
import PushNotificationButton from "@/components/ui/PushNotificationButton";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useCart, type CartItem } from "@/context/CartContext";

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
  onGoToCart?: () => void;
}

export default function ProfileDrawer({ open, onClose, onGoToCart }: Props) {
  const { isAuthenticated, user, logout, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [supportOpen, setSupportOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const qc = useQueryClient();

  // Подгружаем заказы и профиль только пока открыт drawer и юзер залогинен.
  // Кеш сохраняется между открытиями — повторное открытие показывает данные мгновенно.
  const enabled = open && isAuthenticated;
  const { data: ordersData = [], isFetching: loading } = useOrders(enabled);
  const { data: profileData = null } = useProfile(enabled);
  const orders = ordersData ?? [];
  const profile = profileData ?? null;

  // Локальный setter профиля после save — пишем в react-query cache,
  // чтобы UI обновился без повторного запроса.
  const setProfile = (next: UserProfile | null) => {
    qc.setQueryData(queryKeys.profile, next);
  };

  useBodyScrollLockWhen(open);
  const { style: swipeStyle, backdropStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose, isOpen: open });

  function handleLogout() {
    logout();
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        style={backdropStyle}
      />

      <div
        className="fixed z-50 bg-white shadow-2xl flex flex-col
          inset-x-0 bottom-0 rounded-t-2xl max-h-[90svh]
          sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:rounded-none sm:max-h-svh"
        style={swipeStyle}
      >
        {/* Мобайл: drag handle + шапка — вся зона для свайпа вниз */}
        <div className="sm:hidden flex-shrink-0 touch-none select-none cursor-grab active:cursor-grabbing" {...swipeHandlers}>
          <div className="flex justify-center py-2.5">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Личный кабинет</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        {/* Десктоп: шапка без свайпа */}
        <div className="hidden sm:flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Личный кабинет</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!isAuthenticated ? (
            <NotAuthorized onLogin={() => { onClose(); openAuthModal(); }} />
          ) : (
            <div className="px-5 py-4 space-y-5">
              <UserCard
                phone={user?.phone ?? ""}
                email={user?.email ?? ""}
                role={user?.role ?? ""}
                id={user?.id ?? ""}
              />
              <AddressSection
                profile={profile}
                onProfileUpdate={setProfile}
                fallbackName={user?.email?.split("@")[0] || user?.phone || "Пользователь"}
              />
              <OrderHistory orders={orders} loading={loading} onSelect={setSelectedOrder} />

              {/* Переключатель темы */}
              <ThemeToggle isDark={theme === "dark"} onToggle={toggleTheme} />

              {/* Уведомления */}
              <div className="bg-gray-50 rounded-2xl px-4">
                <PushNotificationButton />
              </div>

              {/* Поддержка */}
              <button
                onClick={() => setSupportOpen(true)}
                className="w-full bg-gray-50 rounded-2xl p-4 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-800">Поддержка</span>
                <svg className="w-4 h-4 text-gray-400 ml-auto" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>

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

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDrawerClose={onClose}
          onGoToCart={onGoToCart}
          onCancelled={(updated) => {
            setSelectedOrder(updated);
            // Локально обновляем кеш заказов чтобы UI отразил отмену сразу
            qc.setQueryData<Order[]>(queryKeys.orders, (prev) =>
              (prev ?? []).map((o) => o.id === updated.id ? updated : o),
            );
          }}
        />
      )}

      {supportOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSupportOpen(false)} />
          <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex flex-col items-center px-6 pt-8 pb-2">
              <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-base font-bold text-gray-900 text-center">Поддержка</h2>
              <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
                По любым вопросам вы можете написать нам в WhatsApp
              </p>
            </div>
            <div className="flex flex-col gap-2 px-6 pt-4 pb-8">
              <a
                href="https://wa.me/79640691596"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                +7 964 069-15-96
              </a>
              <button
                onClick={() => setSupportOpen(false)}
                className="w-full h-12 border border-gray-200 text-gray-700 text-sm font-medium rounded-2xl hover:bg-gray-50 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {isDark ? (
          <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        )}
        <span className="text-sm font-semibold text-gray-800">
          {isDark ? "Тёмная тема" : "Светлая тема"}
        </span>
      </div>

      <button
        onClick={onToggle}
        role="switch"
        aria-checked={isDark}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          isDark ? "bg-indigo-600" : "bg-gray-200"
        }`}
      >
        {/* Белый кружок — намеренно inline style, чтобы не попасть под html.dark .bg-white переопределение */}
        <span
          className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform ${
            isDark ? "translate-x-6" : "translate-x-1"
          }`}
          style={{ backgroundColor: "white" }}
        />
      </button>
    </div>
  );
}

function AddressSection({
  profile,
  onProfileUpdate,
  fallbackName,
}: {
  profile: UserProfile | null;
  onProfileUpdate: (p: UserProfile) => void;
  fallbackName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setInput(profile?.address ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = input.trim();
    setSaving(true);
    setError(null);
    try {
      const updated = await usersApi.updateProfile({
        name: profile?.name || fallbackName,
        email: profile?.email,
        address: trimmed || undefined,
      });
      onProfileUpdate(updated);
      setEditing(false);
    } catch {
      setError("Не удалось сохранить адрес");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">Адрес доставки</span>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {profile?.address ? "Изменить" : "Добавить"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ул. Пушкина, д. 1, кв. 10"
            className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 h-9 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          {profile?.address ?? "Адрес не указан"}
        </p>
      )}
    </div>
  );
}

function UserCard({ phone, email, role, id }: { phone: string; email: string; role: string; id: string }) {
  const displayName = email || phone || "—";
  return (
    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{displayName}</p>
          <span className="inline-block mt-0.5 px-2 py-0.5 bg-white/20 text-xs font-medium rounded-full">
            {role === "CLIENT" ? "Клиент" : role}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
        <span className="text-xs text-white/70">ID: {id.slice(0, 8)}…</span>
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

function OrderHistory({
  orders,
  loading,
  onSelect,
}: {
  orders: Order[];
  loading: boolean;
  onSelect: (order: Order) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Показываем только последний заказ когда свёрнуто
  const visibleOrders = expanded ? orders : orders.slice(0, 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">История заказов</h3>
        {!loading && orders.length > 1 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {expanded ? "Скрыть" : `Все (${orders.length})`}
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <OrderCardSkeleton key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-gray-400">
          <span className="text-4xl mb-2">📦</span>
          <p className="text-sm">Заказов пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} onSelect={onSelect} />
          ))}
          {!expanded && orders.length > 1 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-2 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
            >
              Ещё {orders.length - 1} {orders.length - 1 === 1 ? "заказ" : orders.length - 1 < 5 ? "заказа" : "заказов"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onSelect }: { order: Order; onSelect: (order: Order) => void }) {
  const status = STATUS_META[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
  const date = new Date(order.created_at).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(order)}
      className="w-full bg-gray-50 rounded-xl p-3.5 text-left hover:bg-gray-100 transition-colors"
    >
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
        <span className="text-xs text-gray-500">
          {order.payment_method === "CASH" ? "Наличными" : order.payment_method}
        </span>
        <span className="text-sm font-bold text-gray-900">
          {order.final_total.toLocaleString("ru-RU")} ₽
        </span>
      </div>
    </button>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onDrawerClose,
  onGoToCart,
  onCancelled,
}: {
  order: Order;
  onClose: () => void;
  onDrawerClose: () => void;
  onGoToCart?: () => void;
  onCancelled: (updated: Order) => void;
}) {
  const { items: cartItems, replaceItems } = useCart();
  const [full, setFull] = useState<Order>(order);
  const [loading, setLoading] = useState(!order.items);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [repeating, setRepeating] = useState(false);
  const [repeatDone, setRepeatDone] = useState(false);
  // pending — корзина готова, ждём решения пользователя по конфликту
  const [pendingCart, setPendingCart] = useState<CartItem[] | null>(null);

  const minutesSinceCreated = (Date.now() - new Date(full.created_at).getTime()) / 60000;
  const canCancel = minutesSinceCreated < 10 && full.status !== "CANCELLED" && full.status !== "DELIVERED";

  async function handleCancel() {
    setCancelError(null);
    setCancelling(true);
    try {
      await ordersApi.cancelOrder(full.id);
      const updated = await ordersApi.getOrder(full.id);
      setFull(updated);
      onCancelled(updated);
    } catch {
      setCancelError("Не удалось отменить заказ");
    } finally {
      setCancelling(false);
    }
  }

  function applyCart(newCart: CartItem[]) {
    replaceItems(newCart);
    setPendingCart(null);
    setRepeatDone(true);
    setTimeout(() => {
      onClose();
      onDrawerClose();
      onGoToCart?.();
    }, 700);
  }

  async function handleRepeat() {
    const items = full.items;
    if (!items || items.length === 0) return;

    const withProduct = items.filter((i) => i.product_id);
    if (withProduct.length === 0) return;

    setRepeating(true);
    try {
      const storeProducts = await catalogApi.getStoreProducts(full.store_id);
      const productMap = new Map(storeProducts.map((p) => [p.id, p]));

      const newCart: CartItem[] = [];
      for (const item of withProduct) {
        const product = productMap.get(item.product_id!);
        if (product && product.is_available) {
          newCart.push({ product, quantity: item.quantity });
        }
      }

      if (newCart.length === 0) return;

      // Если корзина не пуста — спрашиваем
      if (cartItems.length > 0) {
        setPendingCart(newCart);
      } else {
        applyCart(newCart);
      }
    } catch {
      // silently ignore
    } finally {
      setRepeating(false);
    }
  }

  useEffect(() => {
    if (order.items) return;
    ordersApi.getOrder(order.id)
      .then(setFull)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [order.id]);

  const status = STATUS_META[full.status] ?? { label: full.status, color: "bg-gray-100 text-gray-600" };
  const date = new Date(full.created_at).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
    {/* Конфликт корзины при повторе заказа */}
    {pendingCart && (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingCart(null)} />
        <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex flex-col items-center px-6 pt-8 pb-2">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 text-center">В корзине уже есть товары</h2>
            <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
              Очистить текущую корзину и добавить товары из этого заказа?
            </p>
          </div>
          <div className="flex flex-col gap-2 px-6 pt-4 pb-8">
            <button
              onClick={() => applyCart(pendingCart)}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl transition-colors"
            >
              Очистить корзину и повторить
            </button>
            <button
              onClick={() => setPendingCart(null)}
              className="w-full h-12 border border-gray-200 text-gray-700 text-sm font-medium rounded-2xl hover:bg-gray-50 transition-colors"
            >
              Оставить текущую корзину
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85svh] flex flex-col">

        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400">{date}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              Заказ #{full.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

          {/* Состав */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Состав заказа</p>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : full.items && full.items.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {full.items.map((item: OrderItem) => (
                  <div key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {item.name || "Товар"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.quantity} шт. × {item.price.toLocaleString("ru-RU")} ₽
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {(item.price * item.quantity).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Нет данных</p>
            )}
          </div>

          {/* Суммы */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Товары</span>
              <span>{full.items_total.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Доставка</span>
              <span>{full.delivery_fee.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Итого</span>
              <span>{full.final_total.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>

          {/* Способ оплаты */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Способ оплаты</span>
            <span className="text-sm font-medium text-gray-900">
              {full.payment_method === "CASH" ? "Наличными курьеру" : full.payment_method}
            </span>
          </div>

          {/* Повторить заказ */}
          {!loading && full.items && full.items.some((i) => i.product_id) && (
            <button
              onClick={handleRepeat}
              disabled={repeating || repeatDone}
              className={`w-full h-12 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                repeatDone
                  ? "bg-green-500 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white"
              }`}
            >
              {repeatDone ? (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Добавлено в корзину
                </>
              ) : repeating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Загрузка...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Повторить заказ
                </>
              )}
            </button>
          )}

          {/* Отмена заказа */}
          {canCancel && (
            <div className="pt-1 space-y-2">
              {cancelError && (
                <p className="text-xs text-red-500 text-center">{cancelError}</p>
              )}
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full h-11 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-2xl transition-colors"
              >
                {cancelling ? "Отменяем..." : "Отменить заказ"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
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
