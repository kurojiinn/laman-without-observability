"use client";

import { useEffect, useState } from "react";
import { resolveImageUrl, type Product } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";

interface Props {
  product: Product;
  storeName?: string;
  onClose: () => void;
  /** Если передан — показывает кнопку "Перейти в магазин" вместо корзины */
  onGoToStore?: () => void;
}

export default function ProductModal({ product, storeName, onClose, onGoToStore }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated, openAuthModal } = useAuth();
  const cartItem = items.find((i) => i.product.id === product.id);

  const [qty, setQty] = useState(cartItem?.quantity ?? 1);
  const isFav = isFavorite(product.id);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleFavClick() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    toggleFavorite(product);
  }

  function handleAddToCart() {
    if (cartItem) {
      updateQuantity(product.id, qty);
    } else {
      addItem(product);
      if (qty > 1) updateQuantity(product.id, qty);
    }
    onClose();
  }

  const totalPrice = product.price * qty;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet / Modal */}
      <div className="relative z-10 bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
        {/* Image */}
        <div className="relative w-full aspect-square bg-gray-100 flex-shrink-0">
          {product.image_url ? (
            <img
              src={resolveImageUrl(product.image_url)}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🛍️</div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
            aria-label="Закрыть"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Favorite button */}
          <button
            onClick={handleFavClick}
            className="absolute top-3 left-3 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
            aria-label="В избранное"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "#ef4444" : "none"} stroke={isFav ? "#ef4444" : "#9ca3af"} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-y-auto px-5 pt-5 pb-6 gap-3">
          {/* Store name */}
          {storeName && (
            <p className="text-xs text-indigo-500 font-medium">{storeName}</p>
          )}

          {/* Name */}
          <h2 className="text-lg font-bold text-gray-900 leading-snug">{product.name}</h2>

          {/* Description */}
          {product.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
          )}

          {/* Price */}
          <p className="text-xl font-bold text-gray-900">
            {(onGoToStore ? product.price : totalPrice).toLocaleString("ru-RU")} ₽
            {!onGoToStore && qty > 1 && (
              <span className="text-sm font-normal text-gray-400 ml-1.5">
                ({product.price.toLocaleString("ru-RU")} ₽ × {qty})
              </span>
            )}
          </p>

          {/* Quantity selector — только в контексте магазина */}
          {!onGoToStore && (
            <div className="flex items-center gap-4 mt-1">
              <span className="text-sm text-gray-500">Количество</span>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-700 text-xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-colors active:scale-95"
                >
                  −
                </button>
                <span className="w-8 text-center text-base font-semibold text-gray-900">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-indigo-500 flex items-center justify-center text-white text-xl font-bold hover:bg-indigo-600 hover:border-indigo-600 transition-colors active:scale-95"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Кнопка: корзина (обычный контекст) или перейти в магазин (с главной) */}
          {onGoToStore ? (
            <button
              onClick={onGoToStore}
              className="mt-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-base font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Перейти в магазин
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              className="mt-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-base font-bold rounded-2xl transition-all shadow-sm"
            >
              {cartItem ? "Обновить корзину" : `Добавить в корзину · ${totalPrice.toLocaleString("ru-RU")} ₽`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
