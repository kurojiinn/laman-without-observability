"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { adminApi, resolveImageUrl, type Product } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";

interface Props {
  product: Product;
  storeName?: string;
  onClose: () => void;
  /** Если передан — показывает кнопку "Перейти в магазин" вместо корзины */
  onGoToStore?: () => void;
  /** Вызывается после успешного обновления товара (только для ADMIN) */
  onProductUpdated?: (updated: Product) => void;
}

export default function ProductModal({ product, storeName, onClose, onGoToStore, onProductUpdated }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated, openAuthModal, user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const cartItem = items.find((i) => i.product.id === product.id);

  const [qty, setQty] = useState(cartItem?.quantity ?? 1);
  const isFav = isFavorite(product.id);

  // Admin edit state
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editPrice, setEditPrice] = useState(String(product.price));
  const [editDesc, setEditDesc] = useState(product.description ?? "");
  const [editAvailable, setEditAvailable] = useState(product.is_available);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Превью выбранного файла — освобождаем object URL при размонтировании/смене.
  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(editImageFile);
    setEditImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editImageFile]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useBodyScrollLock();
  const { style: swipeStyle, backdropStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose });

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
      onClose();
    } else {
      const added = addItem(product);
      if (!added) return;
      if (qty > 1) updateQuantity(product.id, qty);
      onClose();
    }
  }

  async function handleSaveEdit() {
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price) || price <= 0) {
      setSaveError("Проверьте название и цену");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      // Текстовые поля и фото — два независимых эндпоинта. Если выбрана новая
      // картинка, грузим её первой; затем обновляем остальные поля. Используем
      // результат последнего вызова — он содержит все актуальные значения.
      let updated = product;
      if (editImageFile) {
        updated = await adminApi.uploadProductImage(product.id, editImageFile);
      }
      updated = await adminApi.updateProduct(product.id, {
        name: editName.trim(),
        price,
        description: editDesc.trim() || undefined,
        is_available: editAvailable,
      });
      onProductUpdated?.(updated);
      setEditImageFile(null);
      setEditMode(false);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const totalPrice = product.price * qty;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[10000] bg-black/50" onClick={onClose} style={backdropStyle} />

      {/* Sheet / Modal */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-0 z-[10001] flex items-end sm:items-center justify-center pointer-events-none"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
      <div className="pointer-events-auto bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92dvh] overflow-y-auto overscroll-contain" style={swipeStyle}>
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center py-2.5 flex-shrink-0 touch-none select-none cursor-grab active:cursor-grabbing" {...swipeHandlers}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* Image — вся зона кратинки тоже работает как drag handle (mobile only) */}
        <div className="relative w-full aspect-square bg-gray-100 sm:touch-auto touch-none select-none" {...swipeHandlers}>
          {editImagePreview ? (
            <img
              src={editImagePreview}
              alt={product.name}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          ) : product.image_url ? (
            <img
              src={resolveImageUrl(product.image_url, "full")}
              alt={product.name}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🛍️</div>
          )}

          {/* Admin: кнопка смены фото — поверх картинки в режиме редактирования */}
          {editMode && isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setEditImageFile(file);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 left-3 right-3 py-2.5 bg-black/60 hover:bg-black/75 text-white text-sm font-semibold rounded-xl backdrop-blur-sm flex items-center justify-center gap-2 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                {editImageFile ? "Заменить фото" : "Загрузить фото"}
              </button>
            </>
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

          {/* Favorite button — только не-ADMIN */}
          {!isAdmin && (
            <button
              onClick={handleFavClick}
              className="absolute top-3 left-3 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors"
              aria-label="В избранное"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "#ef4444" : "none"} stroke={isFav ? "#ef4444" : "#9ca3af"} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}

          {/* Admin: edit toggle */}
          {isAdmin && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors ${editMode ? "bg-indigo-600 text-white" : "bg-white/90 hover:bg-white text-gray-600"}`}
              aria-label="Редактировать"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col px-5 pt-5 pb-6 gap-3">
          {storeName && (
            <p className="text-xs text-indigo-500 font-medium">{storeName}</p>
          )}

          {editMode && isAdmin ? (
            /* ── Admin edit form ── */
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Цена (₽)</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
                  style={{ fontSize: 16 }}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAvailable}
                  onChange={(e) => setEditAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                <span className="text-sm text-gray-700">В наличии</span>
              </label>
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => { setEditMode(false); setEditImageFile(null); }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition-colors"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </div>
          ) : (
            /* ── Normal view ── */
            <>
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{product.name}</h2>

              {product.description && (
                <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
              )}

              <p className="text-xl font-bold text-gray-900">
                {(onGoToStore ? product.price : totalPrice).toLocaleString("ru-RU")} ₽
                {!onGoToStore && qty > 1 && (
                  <span className="text-sm font-normal text-gray-400 ml-1.5">
                    ({product.price.toLocaleString("ru-RU")} ₽ × {qty})
                  </span>
                )}
              </p>

              {/* Quantity selector — только в контексте магазина и не ADMIN */}
              {!onGoToStore && !isAdmin && (
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

              {/* Кнопки действий */}
              {isAdmin ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="mt-2 w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-base font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Редактировать товар
                </button>
              ) : onGoToStore ? (
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
            </>
          )}
        </div>
      </div>
      </div>
    </>,
    document.body
  );
}
