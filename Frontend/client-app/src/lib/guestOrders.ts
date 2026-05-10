// Лёгкий локальный кеш последних заказов гостя.
// Не хранит больше MAX_GUEST_ORDERS (по требованию — 2). Используется
// FavoritesTab/гостевым видом для отображения «истории» без авторизации
// и CartTab — для записи после успешного POST /orders.

export interface GuestOrder {
  id: string;
  created_at: string;
  total: number;
  status: string;
  store_name: string;
}

const STORAGE_KEY = "yuher_guest_orders";
const MAX_GUEST_ORDERS = 2;

export function readGuestOrders(): GuestOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_GUEST_ORDERS) : [];
  } catch {
    return [];
  }
}

export function saveGuestOrder(o: GuestOrder): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readGuestOrders().filter((x) => x.id !== o.id);
    const next = [o, ...existing].slice(0, MAX_GUEST_ORDERS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / приватный режим — игнорируем, фича некритичная
  }
}
