import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "../../entities/order/model";
import { fetchPickerOrder, fetchPickerOrders, updatePickerOrderStatus } from "./api";

export const ordersQueryKey = ["picker-orders"] as const;

export function usePickerOrders() {
  return useQuery({
    queryKey: ordersQueryKey,
    queryFn: fetchPickerOrders,
    refetchInterval: 30_000,
  });
}

export function usePickerOrder(orderId: string) {
  return useQuery({
    queryKey: ["picker-order", orderId],
    queryFn: () => fetchPickerOrder(orderId),
    enabled: Boolean(orderId),
  });
}

export function useUpdateOrderStatus(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: OrderStatus) => updatePickerOrderStatus(orderId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["picker-order", orderId] });
    },
  });
}
