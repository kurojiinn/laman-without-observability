import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ordersQueryKey } from "../orders/hooks";
import { subscribePickerEvents } from "./pickerEvents";

export function usePickerRealtime(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribePickerEvents({
      onEvent: () => {
        void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      },
      onError: (error) => {
        console.error("[picker-panel] SSE error", error.message);
      },
    });

    return () => unsubscribe();
  }, [enabled, queryClient]);
}
