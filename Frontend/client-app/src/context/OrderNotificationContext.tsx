"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:8080/api`;
  return "http://localhost:8080/api";
}

export interface OrderNotification {
  orderId: string;
  message: string;
  finalTotal: number;
}

interface OrderNotificationContextValue {
  notification: OrderNotification | null;
  dismiss: () => void;
  /** ID заказа который надо открыть (push-нотификация / SSE-кнопка). page.tsx читает и открывает drawer. */
  pendingOrderId: string | null;
  openOrder: (orderId: string) => void;
  clearPendingOrder: () => void;
}

const OrderNotificationContext = createContext<OrderNotificationContextValue | null>(null);

export function OrderNotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notification, setNotification] = useState<OrderNotification | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // При первой загрузке читаем ?order=xxx из URL — push-уведомление открывает
  // приложение по этому формату (см. public/sw.js, ветка openWindow).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("order");
    if (id) {
      setPendingOrderId(id);
      // Очищаем query чтобы при reload модалка не открылась снова
      const url = new URL(window.location.href);
      url.searchParams.delete("order");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Если приложение уже открыто, SW шлёт postMessage с orderId по клику на push.
  // Это позволяет открыть модалку без перезагрузки страницы.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string; orderId?: string } | null;
      if (data?.type === "open-order" && data.orderId) {
        setPendingOrderId(data.orderId);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // EventSource с withCredentials отправляет httpOnly cookie автоматически.
    // Бэкенд читает токен из cookie через AuthMiddleware.
    const url = `${getBaseUrl()}/v1/orders/events`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.addEventListener("order_updated", (e) => {
      try {
        const data = JSON.parse(e.data) as {
          order_id: string;
          message: string;
          final_total: number;
        };
        setNotification({
          orderId: data.order_id,
          message: data.message,
          finalTotal: data.final_total,
        });
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [isAuthenticated]);

  const dismiss = useCallback(() => setNotification(null), []);
  const openOrder = useCallback((orderId: string) => setPendingOrderId(orderId), []);
  const clearPendingOrder = useCallback(() => setPendingOrderId(null), []);

  return (
    <OrderNotificationContext.Provider value={{ notification, dismiss, pendingOrderId, openOrder, clearPendingOrder }}>
      {children}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotification(): OrderNotificationContextValue {
  const ctx = useContext(OrderNotificationContext);
  if (!ctx) throw new Error("useOrderNotification must be used inside OrderNotificationProvider");
  return ctx;
}
