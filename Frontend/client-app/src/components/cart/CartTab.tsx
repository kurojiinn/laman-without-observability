"use client";

import { useState } from "react";
import { useCart, type CartItem } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { ordersApi, type CreateOrderPayload } from "@/lib/api";

type View = "cart" | "checkout" | "success";

export default function CartTab() {
  const [view, setView] = useState<View>("cart");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const { items, totalPrice, updateQuantity, removeItem, clear } = useCart();
  const { isAuthenticated, user, openAuthModal } = useAuth();

  if (items.length === 0 && view !== "success") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">🛒</span>
        <p className="text-base font-medium text-gray-500">Корзина пуста</p>
        <p className="text-sm mt-1">Добавьте товары из каталога</p>
      </div>
    );
  }

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
          <p className="text-sm text-gray-400 mb-6">
            #{lastOrderId.slice(0, 8).toUpperCase()}
          </p>
        )}
        <p className="text-sm text-gray-500 mb-8 text-center max-w-xs">
          Мы уже приняли ваш заказ и скоро начнём его собирать
        </p>
        <button
          onClick={() => setView("cart")}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Хорошо
        </button>
      </div>
    );
  }

  if (view === "checkout") {
    return (
      <CheckoutForm
        onBack={() => setView("cart")}
        onSuccess={(orderId) => {
          clear();
          setLastOrderId(orderId);
          setView("success");
        }}
        isAuthenticated={isAuthenticated}
        userPhone={user?.phone ?? ""}
        items={items}
        totalPrice={totalPrice}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Корзина ({items.length})
        </h2>
        <button
          onClick={clear}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Очистить
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {items.map(({ product, quantity }) => (
          <div
            key={product.id}
            className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4"
          >
            <div className="w-14 h-14 bg-gray-50 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🛍️</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {product.price.toLocaleString("ru-RU")} ₽ × {quantity}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => updateQuantity(product.id, quantity - 1)}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-bold"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-semibold">{quantity}</span>
              <button
                onClick={() => updateQuantity(product.id, quantity + 1)}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors text-sm font-bold"
              >
                +
              </button>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {(product.price * quantity).toLocaleString("ru-RU")} ₽
              </p>
              <button
                onClick={() => removeItem(product.id)}
                className="text-xs text-gray-300 hover:text-red-500 transition-colors mt-1"
              >
                удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Товары</span>
          <span>{totalPrice.toLocaleString("ru-RU")} ₽</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Доставка</span>
          <span>200 ₽</span>
        </div>
        <div className="flex justify-between text-sm text-gray-400 mb-4">
          <span>Сервисный сбор (5%)</span>
          <span>{Math.round(totalPrice * 0.05).toLocaleString("ru-RU")} ₽</span>
        </div>
        <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-gray-900">
          <span>Итого</span>
          <span>{(totalPrice + 200 + Math.round(totalPrice * 0.05)).toLocaleString("ru-RU")} ₽</span>
        </div>

        <button
          onClick={() => {
            if (!isAuthenticated) {
              openAuthModal();
            } else {
              setView("checkout");
            }
          }}
          className="w-full mt-4 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
        >
          {isAuthenticated ? "Оформить заказ" : "Войдите для оформления"}
        </button>
      </div>
    </div>
  );
}

interface CheckoutFormProps {
  onBack: () => void;
  onSuccess: (orderId: string) => void;
  isAuthenticated: boolean;
  userPhone: string;
  items: CartItem[];
  totalPrice: number;
}

function CheckoutForm({
  onBack,
  onSuccess,
  isAuthenticated,
  userPhone,
  items,
  totalPrice,
}: CheckoutFormProps) {
  const deliveryFee = 200;
  const serviceFee = Math.round(totalPrice * 0.05);
  const finalTotal = totalPrice + deliveryFee + serviceFee;

  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(userPhone);
  const [guestName, setGuestName] = useState("");
  const [comment, setComment] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) {
      setError("Укажите адрес доставки");
      return;
    }
    if (!phone.trim()) {
      setError("Укажите номер телефона");
      return;
    }

    setError(null);
    setLoading(true);

    let payload: CreateOrderPayload;

    if (isAuthenticated) {
      payload = {
        delivery_address: address.trim(),
        payment_method: paymentMethod,
        items: items.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
        })),
        comment: comment.trim() || undefined,
        customer_phone: phone.trim() || undefined,
      };
    } else {
      payload = {
        delivery_address: address.trim(),
        payment_method: paymentMethod,
        items: items.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
        })),
        comment: comment.trim() || undefined,
        customer_phone: phone.trim() || undefined,
        guest_name: guestName.trim(),
        guest_phone: phone.trim(),
        guest_address: address.trim(),
      };
    }

    try {
      const order = await ordersApi.createOrder(payload);
      onSuccess(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при оформлении заказа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Назад в корзину
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Состав заказа */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Состав заказа</h3>
          <div className="space-y-2">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
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
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Доставка</span>
              <span>200 ₽</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Сервисный сбор (5%)</span>
              <span>{serviceFee.toLocaleString("ru-RU")} ₽</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-1">
              <span>Итого</span>
              <span>{finalTotal.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
        </div>

        {/* Данные получателя */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Данные получателя</h3>

          {!isAuthenticated && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Ваше имя</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Иван Иванов"
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Номер телефона <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 900 000 00 00"
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Адрес доставки <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ул. Пушкина, д. 1, кв. 10"
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Комментарий к заказу</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Позвоните перед приездом, домофон не работает..."
              rows={3}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
            />
          </div>
        </div>

        {/* Способ оплаты */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Способ оплаты</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("CASH")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                paymentMethod === "CASH"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-100 bg-gray-50 hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">💵</span>
              <span className={`text-sm font-medium ${paymentMethod === "CASH" ? "text-indigo-700" : "text-gray-600"}`}>
                Наличными
              </span>
              <span className={`text-xs ${paymentMethod === "CASH" ? "text-indigo-500" : "text-gray-400"}`}>
                Курьеру при получении
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("TRANSFER")}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                paymentMethod === "TRANSFER"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-100 bg-gray-50 hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">💳</span>
              <span className={`text-sm font-medium ${paymentMethod === "TRANSFER" ? "text-indigo-700" : "text-gray-600"}`}>
                Онлайн
              </span>
              <span className={`text-xs ${paymentMethod === "TRANSFER" ? "text-indigo-500" : "text-gray-400"}`}>
                Скоро будет доступно
              </span>
              <span className="absolute top-2 right-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">
                скоро
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
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
      </form>
    </div>
  );
}
