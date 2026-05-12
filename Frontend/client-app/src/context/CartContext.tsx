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
import { toast } from "sonner";
import type { Product, ProductOptionValue } from "@/lib/api";

export interface CartItemOption {
  group_id: string;
  group_name: string;
  value_id: string;
  value_name: string;
  price_delta: number | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  /** Уникальный ключ линии: productId + сортированные value_id опций.
      Один и тот же товар с разными опциями = разные линии. */
  key: string;
  selectedOptions: CartItemOption[];
  /** Базовая цена + сумма price_delta — пересчитывается при добавлении. */
  unitPrice: number;
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  /** Возвращает true если товар добавлен, false если конфликт магазина */
  addItem: (product: Product, selectedValues?: ProductOptionValue[], groupsContext?: { groupId: string; groupName: string }[]) => boolean;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, qty: number) => void;
  clear: () => void;
  /** Заменяет всю корзину (для повтора заказа) */
  replaceItems: (newItems: CartItem[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "yuher_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const raw = JSON.parse(saved) as Partial<CartItem>[];
      // Миграция: в старых записях нет key/unitPrice/selectedOptions.
      const migrated: CartItem[] = raw
        .filter((i): i is Partial<CartItem> & { product: Product; quantity: number } => !!i.product && typeof i.quantity === "number")
        .map((i) => ({
          product: i.product as Product,
          quantity: i.quantity as number,
          key: i.key ?? (i.product as Product).id,
          selectedOptions: i.selectedOptions ?? [],
          unitPrice: i.unitPrice ?? (i.product as Product).price,
        }));
      setItems(migrated);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((
    product: Product,
    selectedValues: ProductOptionValue[] = [],
    groupsContext: { groupId: string; groupName: string }[] = [],
  ): boolean => {
    // Если в корзине уже есть товары из другого магазина — отклоняем.
    if (items.length > 0 && items[0].product.store_id !== product.store_id) {
      setPendingProduct(product);
      return false;
    }

    // Композитный ключ: товар + отсортированные value-id опций.
    // Это позволяет одному product.id жить в разных линиях с разными опциями.
    const sortedValueIds = [...selectedValues].map((v) => v.id).sort();
    const key = [product.id, ...sortedValueIds].join("|");

    // Snapshot опций — храним имена группы/значения и delta, чтобы цена/отображение
    // в корзине не зависели от того, что админ потом изменит на бэке.
    const groupNameById = new Map(groupsContext.map((g) => [g.groupId, g.groupName]));
    const options: CartItemOption[] = selectedValues.map((v) => ({
      group_id: v.group_id,
      group_name: groupNameById.get(v.group_id) ?? "",
      value_id: v.id,
      value_name: v.name,
      price_delta: v.price_delta,
    }));
    const deltaSum = selectedValues.reduce((s, v) => s + (v.price_delta ?? 0), 0);
    const unitPrice = Math.max(0, product.price + deltaSum);

    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1, key, selectedOptions: options, unitPrice }];
    });
    toast.success(`${product.name} в корзине`, { duration: 1800 });
    return true;
  }, [items]);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQuantity = useCallback((key: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.key !== key));
    } else {
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: qty } : i)));
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const replaceItems = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
  }, []);

  const totalCount = items.reduce((s, i) => s + i.quantity, 0);
  // unitPrice уже учитывает опции; для старых линий из localStorage fallback на product.price.
  const totalPrice = items.reduce(
    (s, i) => s + (i.unitPrice ?? i.product.price) * i.quantity,
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
            setItems([{
              product: pendingProduct,
              quantity: 1,
              key: pendingProduct.id,
              selectedOptions: [],
              unitPrice: pendingProduct.price,
            }]);
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
