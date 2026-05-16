"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { catalogApi, ordersApi, usersApi, isStoreOpen, resolveImageUrl, type Store, type CreateOrderPayload, type Product, type OutOfStockAction } from "@/lib/api";
import { saveGuestOrder } from "@/lib/guestOrders";
import ProductModal from "@/components/ui/ProductModal";
import { DeliveryTimePicker, type DeliveryType } from "@/components/ui/DeliveryTimePicker";
import ConsentCheckbox from "@/components/ui/ConsentCheckbox";

type View = "cart" | "checkout" | "success";

// Районы доставки только для магазинов из Ойсхара
const OYSHAR_DISTRICTS = [
  { label: "Ойсхар",  fee: 150 },
  { label: "Нойбер",  fee: 200 },
] as const;

type District = typeof OYSHAR_DISTRICTS[number]["label"];

const INPUT_CLS =
  "w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

interface CartTabProps {
  onGoToStore?: (storeId: string, productId?: string, categoryId?: string) => void;
}

export default function CartTab({ onGoToStore }: CartTabProps) {
  const { items, totalPrice, updateQuantity, removeItem, clear } = useCart();
  const { isAuthenticated, user } = useAuth();

  const [view, setView] = useState<View>("cart");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);

  // Магазин из корзины (для определения города)
  const [store, setStore] = useState<Store | null>(null);
  const isOysharStore = store?.city === "Ойсхар";

  // Шаг 1 — форма
  const [address, setAddress]     = useState("");
  const [phone, setPhone]         = useState(user?.phone ?? "");
  const [comment, setComment]     = useState("");
  const [district, setDistrict]   = useState<District>("Ойсхар");

  // Что делать если товара нет
  const [outOfStockAction, setOutOfStockAction] = useState<OutOfStockAction>("REMOVE");

  // Время доставки
  const [deliveryTime, setDeliveryTime] = useState<{
    type: DeliveryType;
    datetime: Date | null;
    surcharge: number;
  }>({ type: "now", datetime: null, surcharge: 0 });

  // Шаг 2 — отправка
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [consentChecked, setConsentChecked] = useState(false);
  const [consentError, setConsentError]     = useState<string | null>(null);

  // Модалка товара
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Загружаем магазин когда в корзине появляются товары
  useEffect(() => {
    const storeId = items[0]?.product.store_id;
    if (!storeId) { setStore(null); return; }
    catalogApi.getStore(storeId).then(setStore).catch(() => setStore(null));
  }, [items[0]?.product.store_id]);

  // Адрес из профиля
  useEffect(() => {
    if (!isAuthenticated) return;
    usersApi.getProfile().then((p) => { if (p.address) setAddress(p.address); }).catch(() => null);
  }, [isAuthenticated]);

  // Телефон при авторизации
  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  const deliveryFee = isOysharStore
    ? OYSHAR_DISTRICTS.find((d) => d.label === district)!.fee
    : 200;
  const finalTotal  = totalPrice + deliveryFee + deliveryTime.surcharge;

  // ── Успех ─────────────────────────────────────────────────────────────────
  if (view === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Заказ оформлен!</h2>
        {lastOrderId && (
          <p className="text-sm text-gray-400 mb-6">#{lastOrderId.slice(0, 8).toUpperCase()}</p>
        )}
        <p className="text-sm text-gray-500 mb-8 text-center max-w-xs">
          Мы уже приняли ваш заказ и скоро начнём его собирать
        </p>
        <button
          onClick={() => { setView("cart"); setError(null); }}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Хорошо
        </button>
      </div>
    );
  }

  // ── Пустая корзина ─────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">🛒</span>
        <p className="text-base font-medium text-gray-500">Корзина пуста</p>
        <p className="text-sm mt-1">Добавьте товары из каталога</p>
      </div>
    );
  }

  // ── Шаг 2: подтверждение ──────────────────────────────────────────────────
  if (view === "checkout") {
    async function handleOrder() {
      setError(null);
      if (store && !isStoreOpen(store)) {
        setError(
          `Магазин «${store.name}» сейчас закрыт` +
          (store.opens_at && store.closes_at ? ` · Работает ${store.opens_at}–${store.closes_at}` : "")
        );
        return;
      }
      setLoading(true);

      const payload: CreateOrderPayload = {
        delivery_address: address.trim(),
        payment_method: "CASH",
        items: items.map(({ product, quantity, selectedOptions }) => ({
          product_id: product.id,
          quantity,
          // Передаём только value_id'ы — бэк сам подтянет snapshot.
          selected_options: selectedOptions.length > 0 ? selectedOptions.map((o) => o.value_id) : undefined,
        })),
        comment: comment.trim() || undefined,
        customer_phone: phone.trim() || undefined,
        out_of_stock_action: outOfStockAction,
        delivery_type: deliveryTime.type,
        scheduled_at: deliveryTime.datetime?.toISOString() ?? null,
        delivery_surcharge: deliveryTime.surcharge,
      };

      try {
        const order = await ordersApi.createOrder(payload);
        // Кешируем последние 2 заказа в localStorage — гостевой вид
        // FavoritesTab показывает их без обращения к API.
        saveGuestOrder({
          id: order.id,
          created_at: order.created_at ?? new Date().toISOString(),
          total: order.final_total ?? finalTotal,
          status: order.status ?? "NEW",
          store_name: store?.name ?? "Магазин",
        });
        clear();
        setLastOrderId(order.id);
        setView("success");
        toast.success("Заказ оформлен", { description: `№ ${order.id.slice(0, 8).toUpperCase()}` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ошибка при оформлении заказа";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Назад */}
        <button
          onClick={() => { setView("cart"); setError(null); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Назад
        </button>

        {/* Состав заказа + суммы */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Состав заказа</h3>
          <div className="space-y-2">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {product.image_url ? (
                      <img src={resolveImageUrl(product.image_url, "thumb")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-sm">🛍️</span>
                    )}
                  </div>
                  <span className="text-gray-700 truncate">{product.name}</span>
                  <span className="text-gray-400 flex-shrink-0">× {quantity}</span>
                </div>
                <span className="font-medium text-gray-900 flex-shrink-0 ml-3">
                  {(product.price * quantity).toLocaleString("ru-RU")} ₽
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Товары</span>
              <span>{totalPrice.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>
                Доставка
                {isOysharStore && (
                  <span className="ml-1 text-gray-400">({district})</span>
                )}
              </span>
              <span>{deliveryFee.toLocaleString("ru-RU")} ₽</span>
            </div>
            {deliveryTime.type === "express" && (
              <div className="flex justify-between text-sm font-medium" style={{ color: "#5DCAA5" }}>
                <span>⚡ Срочная доставка</span>
                <span>+{deliveryTime.surcharge.toLocaleString("ru-RU")} ₽</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Итого</span>
              <span>{finalTotal.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
        </div>

        {/* Способ оплаты */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Способ оплаты</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50">
              <span className="text-2xl">💵</span>
              <span className="text-sm font-medium text-indigo-700">Наличными</span>
              <span className="text-xs text-indigo-500">Курьеру при получении</span>
            </div>
            <div className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed select-none">
              <span className="text-2xl">💳</span>
              <span className="text-sm font-medium text-gray-400">Онлайн</span>
              <span className="text-xs text-gray-400">Скоро будет доступно</span>
              <span className="absolute top-2 right-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                скоро
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleOrder}
          disabled={loading}
          className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Оформляем...
            </>
          ) : (
            `Заказать на ${finalTotal.toLocaleString("ru-RU")} ₽`
          )}
        </button>
      </div>
    );
  }

  // ── Шаг 1: корзина + форма ────────────────────────────────────────────────
  function handleToCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!consentChecked) {
      setConsentError("Необходимо дать согласие на обработку персональных данных");
      return;
    }
    setConsentError(null);
    if (store && !isStoreOpen(store)) {
      setError(
        `Магазин «${store.name}» сейчас закрыт` +
        (store.opens_at && store.closes_at ? ` · Работает ${store.opens_at}–${store.closes_at}` : "")
      );
      return;
    }
    // Валидация телефона: 10 цифр после кода страны (+7 или 8).
    // Принимаем форматы: +79001234567, 89001234567, 9001234567 — нормализуем все к 10-значному формату.
    const phoneDigits = phone.replace(/\D/g, "");
    const normalizedPhone = phoneDigits.startsWith("7") || phoneDigits.startsWith("8")
      ? phoneDigits.slice(1)
      : phoneDigits;
    if (normalizedPhone.length !== 10) {
      setError("Введите корректный номер: например +7 900 123 45 67");
      return;
    }
    // Российские мобильные номера начинаются с 9
    if (!normalizedPhone.startsWith("9")) {
      setError("Это не похоже на мобильный номер. Проверьте код оператора");
      return;
    }

    if (!address.trim())  { setError("Укажите адрес доставки"); return; }

    // Сохраняем нормализованный телефон в state — на бэк уйдёт +7XXXXXXXXXX
    setPhone("+7" + normalizedPhone);
    setError(null);
    setView("checkout");
  }

  return (
    <form onSubmit={handleToCheckout} className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">

      {/* Товары */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Корзина ({items.length})</h2>
          <button type="button" onClick={clear} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Очистить
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const { product, quantity, key, unitPrice, selectedOptions } = item;
            return (
            <div key={key} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 cursor-pointer" onClick={() => setSelectedProduct(product)}>
              <div className="w-14 h-14 bg-gray-50 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                {product.image_url ? (
                  <img src={resolveImageUrl(product.image_url, "thumb")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-2xl">🛍️</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</p>
                {selectedOptions.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {selectedOptions.map((o) => `${o.group_name}: ${o.value_name}`).join(" · ")}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-0.5">
                  {unitPrice.toLocaleString("ru-RU")} ₽ × {quantity}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => updateQuantity(key, quantity - 1)}
                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-bold">
                  −
                </button>
                <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
                <button type="button" onClick={() => updateQuantity(key, quantity + 1)}
                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-bold">
                  +
                </button>
              </div>

              <div className="text-right flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm font-bold text-gray-900">
                  {(unitPrice * quantity).toLocaleString("ru-RU")} ₽
                </p>
                <button type="button" onClick={() => removeItem(key)}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors mt-1">
                  удалить
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Форма получателя */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Данные получателя</h3>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Номер телефона <span className="text-red-400">*</span>
          </label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 900 000 00 00" className={INPUT_CLS} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Адрес доставки <span className="text-red-400">*</span>
          </label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="ул. А. Кадырова, дом 10" className={INPUT_CLS} />
        </div>

        {/* Район доставки — только для магазинов из Ойсхара */}
        {isOysharStore && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Район доставки</label>
            <div className="grid grid-cols-2 gap-2">
              {OYSHAR_DISTRICTS.map(({ label, fee }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDistrict(label)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-sm transition-all ${
                    district === label
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span>{label}</span>
                  <span className={`text-xs font-medium ${district === label ? "text-indigo-500" : "text-gray-400"}`}>
                    {fee} ₽
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Комментарий к заказу</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Например: позвоните когда подъедете, ориентир — синие ворота..."
            rows={3}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>
      </div>

      {/* Время доставки */}
      <DeliveryTimePicker
        defaultValue={{ type: "now" }}
        onSelect={(type, datetime) => {
          setDeliveryTime({
            type,
            datetime: datetime ?? null,
            surcharge: type === "express" ? 100 : 0,
          });
        }}
      />

      {/* Что делать если товара нет */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Если товара нет в наличии</h3>
        <p className="text-xs text-gray-400 mb-3">Сборщик увидит ваш выбор и поступит согласно инструкции</p>
        <div className="space-y-2">
          {([
            { value: "REMOVE",  icon: "🗑️", title: "Убрать товар",       desc: "Исключить из заказа и пересчитать сумму" },
            { value: "REPLACE", icon: "🔄", title: "Заменить на аналог",  desc: "Сборщик подберёт похожий товар" },
            { value: "CALL",    icon: "📞", title: "Позвонить мне",       desc: "Уточним вместе, что можно взять вместо" },
          ] as { value: OutOfStockAction; icon: string; title: string; desc: string }[]).map(({ value, icon, title, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setOutOfStockAction(value)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                outOfStockAction === value
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              <span className="text-xl flex-shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${outOfStockAction === value ? "text-indigo-700" : "text-gray-800"}`}>
                  {title}
                </p>
                <p className={`text-xs mt-0.5 ${outOfStockAction === value ? "text-indigo-500" : "text-gray-400"}`}>
                  {desc}
                </p>
              </div>
              {outOfStockAction === value && (
                <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <ConsentCheckbox
        checked={consentChecked}
        onChange={(v) => { setConsentChecked(v); if (v) setConsentError(null); }}
        error={consentError}
      />

      <button
        type="submit"
        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
      >
        Оформить заказ
      </button>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onGoToStore={onGoToStore ? () => {
            setSelectedProduct(null);
            onGoToStore(selectedProduct.store_id, selectedProduct.id, selectedProduct.category_id);
          } : undefined}
        />
      )}
    </form>
  );
}
