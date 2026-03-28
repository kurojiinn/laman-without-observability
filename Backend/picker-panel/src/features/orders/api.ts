import { z } from "zod";
import { httpRequest } from "../../shared/api/http";
import type { PickerOrder, OrderStatus } from "../../entities/order/model";

const orderSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable().optional(),
  courier_id: z.string().uuid().nullable().optional(),
  guest_name: z.string().nullable().optional(),
  guest_phone: z.string().nullable().optional(),
  guest_address: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  status: z.string(),
  store_id: z.string().uuid(),
  payment_method: z.string(),
  items_total: z.number(),
  service_fee: z.number(),
  delivery_fee: z.number(),
  final_total: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  picker_id: z.string().uuid().nullable().optional(),
});

const ordersSchema = z.array(orderSchema).nullish().transform((value) => value ?? []);

function mapOrder(raw: z.infer<typeof orderSchema>): PickerOrder {
  return {
    id: raw.id,
    userId: raw.user_id ?? null,
    courierId: raw.courier_id ?? null,
    guestName: raw.guest_name ?? null,
    guestPhone: raw.guest_phone ?? null,
    guestAddress: raw.guest_address ?? null,
    comment: raw.comment ?? null,
    status: raw.status as OrderStatus,
    storeId: raw.store_id,
    paymentMethod: raw.payment_method,
    itemsTotal: raw.items_total,
    serviceFee: raw.service_fee,
    deliveryFee: raw.delivery_fee,
    finalTotal: raw.final_total,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pickerId: raw.picker_id ?? null,
  };
}

export async function fetchPickerOrders(): Promise<PickerOrder[]> {
  const data = await httpRequest<unknown>("/api/v1/picker", { authorized: true });
  return ordersSchema.parse(data).map(mapOrder);
}

export async function fetchPickerOrder(orderId: string): Promise<PickerOrder> {
  const data = await httpRequest<unknown>(`/api/v1/picker/orders/${orderId}`, {
    authorized: true,
  });
  return mapOrder(orderSchema.parse(data));
}

export async function updatePickerOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await httpRequest<{ message: string }>(`/api/v1/picker/orders/${orderId}/status`, {
    method: "PUT",
    authorized: true,
    body: { status },
  });
}
