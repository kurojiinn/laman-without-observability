export type StoreCategoryType = "FOOD" | "CLOTHES" | "BUILDING" | "HOME" | "PHARMACY" | "AUTO";

export const STORE_CATEGORY_LABELS: Record<StoreCategoryType, string> = {
  FOOD: "🍔 Общепит",
  CLOTHES: "👕 Одежда",
  HOME: "🏠 Быт",
  BUILDING: "🏗️ Стройка",
  PHARMACY: "💊 Аптека",
  AUTO: "🚗 Авто",
};

export type Store = {
  id: string;
  name: string;
  address: string;
  city?: string;
  phone?: string | null;
  description?: string | null;
  image_url?: string | null;
  rating: number;
  category_type: StoreCategoryType;
  opens_at?: string | null;
  closes_at?: string | null;
};

export type Category = {
  id: string;
  name: string;
  description?: string | null;
};

export type Product = {
  id: string;
  store_id: string;
  category_id: string;
  subcategory_id?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
  weight?: number | null;
  is_available: boolean;
  created_at: string;
};

export type DashboardStats = {
  total_registered_users: number;
  total_guests: number;
  active_orders_count: number;
  today_revenue: number;
};

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

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "Новый",
  ACCEPTED_BY_PICKER: "Принят пикером",
  ASSEMBLING: "Собирается",
  ASSEMBLED: "Собран",
  WAITING_COURIER: "Ждёт курьера",
  COURIER_PICKED_UP: "У курьера",
  DELIVERING: "Везут",
  DELIVERED: "Доставлен",
  CANCELLED: "Отменён",
  NEEDS_CONFIRMATION: "Нужно подтверждение",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  ACCEPTED_BY_PICKER: "bg-purple-100 text-purple-700",
  ASSEMBLING: "bg-yellow-100 text-yellow-700",
  ASSEMBLED: "bg-orange-100 text-orange-700",
  WAITING_COURIER: "bg-amber-100 text-amber-700",
  COURIER_PICKED_UP: "bg-indigo-100 text-indigo-700",
  DELIVERING: "bg-sky-100 text-sky-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  NEEDS_CONFIRMATION: "bg-rose-100 text-rose-700",
};

export type AdminOrderItem = {
  product_name: string;
  quantity: number;
  price: number;
};

export type AdminOrder = {
  id: string;
  user_id?: string | null;
  customer_phone?: string | null;
  guest_phone?: string | null;
  guest_name?: string | null;
  delivery_address?: string | null;
  comment?: string | null;
  status: OrderStatus;
  store_id: string;
  payment_method: string;
  items_total: number;
  service_fee: number;
  delivery_fee: number;
  final_total: number;
  items?: AdminOrderItem[];
  created_at: string;
  updated_at: string;
};

export type FeaturedBlockType = "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook";

export const FEATURED_BLOCK_LABELS: Record<FeaturedBlockType, string> = {
  new_items: "✨ Новинки",
  hits: "🔥 Популярные",
  movie_night: "🍿 Для кино",
  quick_snack: "⚡ Быстрый перекус",
  lazy_cook: "😴 Лень готовить",
};

export type FeaturedItem = {
  id: string;
  product_id: string;
  block_type: FeaturedBlockType;
  position: number;
  created_at: string;
};

export type Recipe = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type RecipeIngredient = Product & { quantity: number };

export type RecipeWithProducts = Recipe & { products: RecipeIngredient[] };
