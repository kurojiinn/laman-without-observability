import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ordersQueryKey } from "../orders/hooks";
import { subscribePickerEvents } from "./pickerEvents";
import { unlockAudio } from "./audio";

// SSE-хук отвечает только за одно: при любом событии триггерить рефетч.
// Детектирование изменений (новый заказ / отмена) — в OrdersPage через сравнение данных.
// Это надёжно: работает даже если SSE-событие потерялось при обрыве соединения.
export function usePickerRealtime(enabled: boolean) {
  const queryClient = useQueryClient();

  // Разблокируем AudioContext при первом click или touch (мобилы).
  useEffect(() => {
    document.addEventListener("click", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);
    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribePickerEvents({
      onEvent: () => {
        // SSE только триггерит рефетч — сравнение данных определит что изменилось.
        void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      },
      onError: (error) => {
        console.error("[picker-panel] SSE error", error.message);
      },
    });
    return () => unsubscribe();
  }, [enabled, queryClient]);
}
