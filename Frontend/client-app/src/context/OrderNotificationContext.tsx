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
}

const OrderNotificationContext = createContext<OrderNotificationContextValue | null>(null);

export function OrderNotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notification, setNotification] = useState<OrderNotification | null>(null);
  const esRef = useRef<EventSource | null>(null);

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

  return (
    <OrderNotificationContext.Provider value={{ notification, dismiss }}>
      {children}
    </OrderNotificationContext.Provider>
  );
}

export function useOrderNotification(): OrderNotificationContextValue {
  const ctx = useContext(OrderNotificationContext);
  if (!ctx) throw new Error("useOrderNotification must be used inside OrderNotificationProvider");
  return ctx;
}
