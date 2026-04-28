"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Product } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  /** Возвращает true если товар добавлен, false если конфликт магазина */
  addItem: (product: Product) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clear: () => void;
  /** Заменяет всю корзину (для повтора заказа) */
  replaceItems: (newItems: CartItem[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "yuher_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Product): boolean => {
    // Не авторизован — открываем модалку входа
    if (!isAuthenticated) {
      openAuthModal();
      return false;
    }

    // Если в корзине уже есть товары из другого магазина — отклоняем
    if (items.length > 0 && items[0].product.store_id !== product.store_id) {
      setPendingProduct(product);
      return false;
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    return true;
  }, [items, isAuthenticated, openAuthModal]);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.product.id === productId ? { ...i, quantity: qty } : i
        )
      );
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const replaceItems = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
  }, []);

  const totalCount = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce(
    (s, i) => s + i.product.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, totalCount, totalPrice, addItem, removeItem, updateQuantity, clear, replaceItems }}
    >
      {children}

      {/* Диалог конфликта магазинов */}
      {pendingProduct && (
        <StoreConflictModal
          onClose={() => setPendingProduct(null)}
          onClearCart={() => {
            setItems([{ product: pendingProduct, quantity: 1 }]);
            setPendingProduct(null);
          }}
        />
      )}
    </CartContext.Provider>
  );
}

function StoreConflictModal({
  onClose,
  onClearCart,
}: {
  onClose: () => void;
  onClearCart: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Иконка */}
        <div className="flex flex-col items-center px-6 pt-8 pb-2">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>

          <h2 className="text-base font-bold text-gray-900 text-center">
            Товары из разных магазинов
          </h2>
          <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
            Пока что нельзя заказывать товары из разных магазинов одновременно. В скором времени мы добавим такой функционал!
          </p>
        </div>

        {/* Кнопки */}
        <div className="flex flex-col gap-2 px-6 pt-4 pb-8">
          <button
            onClick={onClearCart}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl transition-colors"
          >
            Очистить корзину и добавить
          </button>
          <button
            onClick={onClose}
            className="w-full h-12 border border-gray-200 text-gray-700 text-sm font-medium rounded-2xl hover:bg-gray-50 transition-colors"
          >
            Оставить текущую корзину
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
