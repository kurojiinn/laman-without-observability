import { z } from "zod";
import { httpRequest } from "../../shared/api/http";
import type { PickerOrder, OrderStatus } from "../../entities/order/model";

const orderItemOptionSchema = z.object({
  group_name: z.string(),
  value_name: z.string(),
  price_delta: z.number().nullable().optional(),
});

const orderItemSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string(),
  image_url: z.string().nullable().optional(),
  quantity: z.number(),
  price: z.number(),
  options: z.array(orderItemOptionSchema).nullish().transform((v) => v ?? []),
});

const orderSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable().optional(),
  courier_id: z.string().uuid().nullable().optional(),
  guest_name: z.string().nullable().optional(),
  guest_phone: z.string().nullable().optional(),
  guest_address: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  delivery_address: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  out_of_stock_action: z.enum(["REMOVE", "REPLACE", "CALL"]).nullable().optional(),
  status: z.string(),
  store_id: z.string().uuid(),
  payment_method: z.string(),
  items_total: z.number(),
  service_fee: z.number(),
  delivery_fee: z.number(),
  final_total: z.number(),
  delivery_type: z.enum(["now", "scheduled", "express"]).nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  delivery_surcharge: z.number().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  picker_id: z.string().uuid().nullable().optional(),
  items: z.array(orderItemSchema).optional().default([]),
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
    customerPhone: raw.customer_phone ?? null,
    deliveryAddress: raw.delivery_address ?? null,
    comment: raw.comment ?? null,
    outOfStockAction: raw.out_of_stock_action ?? null,
    status: raw.status as OrderStatus,
    storeId: raw.store_id,
    paymentMethod: raw.payment_method,
    itemsTotal: raw.items_total,
    serviceFee: raw.service_fee,
    deliveryFee: raw.delivery_fee,
    finalTotal: raw.final_total,
    deliveryType: raw.delivery_type ?? null,
    scheduledAt: raw.scheduled_at ?? null,
    deliverySurcharge: raw.delivery_surcharge ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pickerId: raw.picker_id ?? null,
    items: (raw.items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id ?? null,
      productName: item.product_name,
      imageUrl: item.image_url ?? null,
      quantity: item.quantity,
      price: item.price,
      options: (item.options ?? []).map((o) => ({
        groupName: o.group_name,
        valueName: o.value_name,
        priceDelta: o.price_delta ?? null,
      })),
    })),
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

export async function addOrderItem(
  orderId: string,
  item: { product_name: string; price: number; quantity: number },
): Promise<void> {
  await httpRequest(`/api/v1/picker/orders/${orderId}/items`, {
    method: "POST",
    authorized: true,
    body: item,
  });
}

export async function removeOrderItem(orderId: string, itemId: string): Promise<void> {
  await httpRequest(`/api/v1/picker/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
    authorized: true,
  });
}
