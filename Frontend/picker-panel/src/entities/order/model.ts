export type OutOfStockAction = "REMOVE" | "REPLACE" | "CALL";

export function outOfStockLabel(action: OutOfStockAction | null | undefined): string {
  switch (action) {
    case "REMOVE":  return "Убрать товар из заказа";
    case "REPLACE": return "Заменить на аналог";
    case "CALL":    return "Позвонить клиенту";
    default:        return "Не указано";
  }
}

export type OrderStatus =
  | "NEW"
  | "ACCEPTED_BY_PICKER"
  | "ASSEMBLING"
  | "ASSEMBLED"
  | "WAITING_COURIER"
  | "COURIER_PICKED_UP"
  | "DELIVERING"
  | "DELIVERED"
  | "CANCELLED"
  | "NEEDS_CONFIRMATION";

export type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  imageUrl: string | null;
  quantity: number;
  price: number;
};

export type PickerOrder = {
  id: string;
  userId?: string | null;
  courierId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestAddress?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  comment?: string | null;
  outOfStockAction?: OutOfStockAction | null;
  status: OrderStatus;
  storeId: string;
  paymentMethod: string;
  itemsTotal: number;
  serviceFee: number;
  deliveryFee: number;
  finalTotal: number;
  createdAt: string;
  updatedAt: string;
  pickerId?: string | null;
  items: OrderItem[];
};

const transitions: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["ACCEPTED_BY_PICKER", "CANCELLED"],
  ACCEPTED_BY_PICKER: ["ASSEMBLING", "NEEDS_CONFIRMATION", "CANCELLED"],
  NEEDS_CONFIRMATION: ["ASSEMBLING", "CANCELLED"],
  ASSEMBLING: ["ASSEMBLED", "CANCELLED"],
  ASSEMBLED: ["WAITING_COURIER", "CANCELLED"],
  WAITING_COURIER: ["COURIER_PICKED_UP"],
  COURIER_PICKED_UP: ["DELIVERING"],
  DELIVERING: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const pickerAllowed: Set<OrderStatus> = new Set([
  "ACCEPTED_BY_PICKER",
  "ASSEMBLING",
  "ASSEMBLED",
  "NEEDS_CONFIRMATION",
  "CANCELLED",
]);

export function getPickerActions(status: OrderStatus): OrderStatus[] {
  return transitions[status].filter((next) => pickerAllowed.has(next));
}

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "NEW":
      return "Новый";
    case "ACCEPTED_BY_PICKER":
      return "Принят";
    case "ASSEMBLING":
      return "Сборка";
    case "ASSEMBLED":
      return "Собран";
    case "WAITING_COURIER":
      return "Ожидает курьера";
    case "COURIER_PICKED_UP":
      return "Курьер забрал";
    case "DELIVERING":
      return "В пути";
    case "DELIVERED":
      return "Доставлен";
    case "CANCELLED":
      return "Отменен";
    case "NEEDS_CONFIRMATION":
      return "Нужно уточнение";
  }
}

export function statusPriority(status: OrderStatus): number {
  switch (status) {
    case "NEW":
      return 0;
    case "NEEDS_CONFIRMATION":
      return 1;
    case "ACCEPTED_BY_PICKER":
      return 2;
    case "ASSEMBLING":
      return 3;
    case "ASSEMBLED":
      return 4;
    case "WAITING_COURIER":
      return 5;
    default:
      return 100;
  }
}
