"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { resolveImageUrl, type Product } from "@/lib/api";
import { readGuestOrders, type GuestOrder } from "@/lib/guestOrders";
import ProductModal from "@/components/ui/ProductModal";

// Бэкенд оперирует длинным списком статусов; здесь сгруппированы под
// упрощённые лейблы, согласованные с ТЗ (NEW/CONFIRMED/IN_PROGRESS/...).
const STATUS_LABELS: Record<string, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтверждён",
  ACCEPTED_BY_PICKER: "Подтверждён",
  NEEDS_CONFIRMATION: "Требует уточнения",
  IN_PROGRESS: "Собирается",
  ASSEMBLING: "Собирается",
  ASSEMBLED: "Собран",
  WAITING_COURIER: "Ждёт курьера",
  COURIER_PICKED_UP: "В пути",
  DELIVERING: "В пути",
  DELIVERED: "Доставлен ✓",
  CANCELLED: "Отменён",
};

export default function FavoritesTab({ search }: { search: string }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { favorites, loading, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const q = search.trim().toLowerCase();
  const visibleFavorites = q
    ? favorites.filter((p) => p.name.toLowerCase().includes(q))
    : favorites;

  if (!isAuthenticated) {
    return <GuestView openAuthModal={openAuthModal} />;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-2xl aspect-[3/4] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">🤍</span>
        <p className="text-base font-medium text-gray-500">Избранное пусто</p>
        <p className="text-sm text-gray-400 mt-1">Нажмите на сердечко у товара, чтобы добавить</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <p className="text-sm text-gray-400 mb-4">{favorites.length} {pluralize(favorites.length, "товар", "товара", "товаров")}</p>

      {visibleFavorites.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-5xl mb-3">🔍</span>
          <p className="text-sm">Ничего не найдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {visibleFavorites.map((product) => (
            <FavoriteCard
              key={product.id}
              product={product}
              onOpen={() => setSelectedProduct(product)}
              onAdd={() => addItem(product)}
              onRemove={() => toggleFavorite(product)}
            />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

function FavoriteCard({
  product,
  onOpen,
  onAdd,
  onRemove,
}: {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
      onClick={onOpen}
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url, "card")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
        )}
        {/* Remove from favorites */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
          aria-label="Убрать из избранного"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-0.5 line-clamp-1">{product.description ?? ""}</p>
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{product.name}</p>
        <div className="flex items-center justify-between mt-2 gap-1">
          <span className="text-sm font-bold text-gray-900 min-w-0 truncate">
            {product.price.toLocaleString("ru-RU")} ₽
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="w-7 h-7 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full flex items-center justify-center transition-all text-sm font-bold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function GuestView({ openAuthModal }: { openAuthModal: () => void }) {
  const [orders, setOrders] = useState<GuestOrder[]>([]);

  // localStorage недоступен на сервере — читаем после mount.
  useEffect(() => {
    setOrders(readGuestOrders());
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {orders.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 px-1">Последние заказы</h2>
          <div className="space-y-2">
            {orders.map((o) => <GuestOrderCard key={o.id} order={o} />)}
          </div>
        </section>
      )}

      <section className="flex flex-col items-center py-10 text-gray-400">
        <span className="text-6xl mb-3">🤍</span>
        <p className="text-base font-medium text-gray-500">Войдите, чтобы видеть избранное</p>
        <p className="text-sm text-gray-400 mt-1">Сохраняйте товары и возвращайтесь к ним</p>
      </section>

      <section className="rounded-2xl p-5" style={{ background: "#121430" }}>
        <p className="text-sm font-medium text-center mb-3" style={{ color: "#5DCAA5" }}>
          Войдите чтобы сохранить историю заказов и избранное
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="w-full py-3 rounded-xl text-white font-semibold text-sm active:scale-[0.99] transition-transform"
          style={{ background: "#4B5EFC" }}
        >
          Войти
        </button>
      </section>
    </div>
  );
}

function GuestOrderCard({ order }: { order: GuestOrder }) {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusLabel = STATUS_LABELS[order.status] ?? order.status;
  const isDelivered = order.status === "DELIVERED";
  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="rounded-2xl p-4" style={{ background: "#121430" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-white/60">
          № {order.id.slice(0, 8).toUpperCase()}
        </span>
        <span className="font-bold text-white text-sm">
          {order.total.toLocaleString("ru-RU")} ₽
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/60 truncate flex-1 min-w-0">
          <span className="text-white/80">{order.store_name}</span>
          <span className="text-white/30 mx-1">·</span>
          {dateStr}
        </p>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: isDelivered ? "rgba(93,202,165,0.15)" : isCancelled ? "rgba(255,107,107,0.15)" : "#152A32",
            color: isDelivered ? "#5DCAA5" : isCancelled ? "#ff6b6b" : "rgba(255,255,255,0.7)",
          }}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
