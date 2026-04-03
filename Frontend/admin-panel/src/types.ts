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
  guest_name?: string | null;
  guest_phone?: string | null;
  status: string;
  final_total: number;
  created_at: string;
};
