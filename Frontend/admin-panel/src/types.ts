export type StoreCategoryType =
  | "FOOD"
  | "CLOTHES"
  | "BUILDING"
  | "HOME"
  | "PHARMACY"
  | "AUTO";

export type Store = {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  description?: string | null;
  image_url?: string | null;
  rating: number;
  category_type: StoreCategoryType;
};

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
};

export type DashboardStats = {
  total_registered_users: number;
  total_guests: number;
  active_orders_count: number;
  today_revenue: number;
};

export type AdminOrder = {
  id: string;
  user_id?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  comment?: string | null;
  status: string;
  store_id: string;
  payment_method: string;
  items_total: number;
  service_fee: number;
  delivery_fee: number;
  final_total: number;
  created_at: string;
  updated_at: string;
};

export type FeaturedBlockType = "new_items" | "hits" | "movie_night";

export const FEATURED_BLOCK_LABELS: Record<FeaturedBlockType, string> = {
  new_items: "Новинки",
  hits: "Хиты",
  movie_night: "На вечернее кино",
};

export type FeaturedItem = {
  id: string;
  product_id: string;
  block_type: FeaturedBlockType;
  position: number;
  created_at: string;
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
