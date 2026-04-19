import { tokenStore } from "@/lib/tokenStore";

// Возвращает base URL для API.
// Приоритет: NEXT_PUBLIC_API_URL → динамический hostname браузера → localhost.
// Это позволяет открывать сайт по любому IP (192.168.x.x, другое устройство)
// без изменения конфигурации.
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8080/api`;
  }
  return "http://localhost:8080/api";
}

// Нормализует image_url из БД.
// MinIO URL (/laman-images/...) отдаётся напрямую с заменой хоста на текущий.
// Старые /uploads/ URL тоже корректируются на текущий API-хост.
export function resolveImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/laman-images/")) {
      // MinIO: заменяем хост на текущий, порт 9000
      const minioHost = typeof window !== "undefined"
        ? `http://${window.location.hostname}:9000`
        : "http://localhost:9000";
      return minioHost + parsed.pathname;
    }
    // Старые /uploads/ — переадресуем на API
    const apiHost = new URL(getBaseUrl()).origin;
    return apiHost + parsed.pathname;
  } catch {
    return url;
  }
}

export function getUploadUrl(filename: string): string {
  return resolveImageUrl(`http://placeholder/uploads/${filename}`) ?? `/uploads/${filename}`;
}

function getBaseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = tokenStore.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    credentials: "include", // отправляем httpOnly cookie автоматически
    headers: { ...getBaseHeaders(), ...options.headers },
  });

  if (!res.ok) {
    // Вытаскиваем error из тела ответа Go-бэкенда: { "error": "..." }
    const body = await res.json().catch(() => null);
    const message =
      (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ─── Catalog types ───────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

export interface Product {
  id: string;
  category_id: string;
  subcategory_id?: string;
  store_id: string;
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  weight?: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  description?: string;
  image_url?: string;
  rating: number;
  category_type: string;
  opens_at?: string;
  closes_at?: string;
  lat?: number;
  lng?: number;
  created_at: string;
  updated_at: string;
}

/** Возвращает true если магазин сейчас открыт (или часы не заданы). */
export function isStoreOpen(store: Store): boolean {
  if (!store.opens_at || !store.closes_at) return true;
  const now = new Date();
  const [oh, om] = store.opens_at.split(":").map(Number);
  const [ch, cm] = store.closes_at.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  // Поддержка ночного режима (например 22:00 – 02:00)
  if (open <= close) return cur >= open && cur < close;
  return cur >= open || cur < close;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  name: string;
  quantity: number;
  price: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id?: string;
  status: string;
  store_id: string;
  payment_method: string;
  items_total: number;
  service_fee: number;
  delivery_fee: number;
  final_total: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface Scenario {
  id: string;
  label: string;
  subtitle: string;
  section_key: string;
  image_url?: string;
  emoji?: string;
  position: number;
  is_active: boolean;
}

export const catalogApi = {
  getCategories: () => api.get<Category[]>("/v1/catalog/categories"),

  getSubcategories: (categoryId: string) =>
    api.get<Subcategory[]>(`/v1/catalog/subcategories?category_id=${categoryId}`),

  getProducts: (params?: { category_id?: string; subcategory_id?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.subcategory_id) q.set("subcategory_id", params.subcategory_id);
    if (params?.search) q.set("search", params.search);
    q.set("available_only", "true");
    return api.get<Product[]>(`/v1/catalog/products?${q}`);
  },

  getStores: (params?: { search?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    return api.get<Store[]>(`/v1/stores?${q}`);
  },

  getStore: (id: string) => api.get<Store>(`/v1/stores/${id}`),

  getStoreSubcategories: (storeId: string) =>
    api.get<Subcategory[]>(`/v1/stores/${storeId}/subcategories`),

  getStoreProducts: (storeId: string, params?: { search?: string; subcategory_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    q.set("available_only", "true");
    if (params?.search) q.set("search", params.search);
    if (params?.subcategory_id) q.set("subcategory_id", params.subcategory_id);
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    return api.get<Product[]>(`/v1/stores/${storeId}/products?${q}`);
  },

  getFeatured: (block: "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook") =>
    api.get<Product[]>(`/v1/catalog/featured?block=${block}`),

  getRecipes: () => api.get<RecipeWithProducts[]>("/v1/catalog/recipes"),
  getRecipe: (id: string) => api.get<RecipeWithProducts>(`/v1/catalog/recipes/${id}`),
  getScenarios: () => api.get<Scenario[]>("/v1/catalog/scenarios"),
  getStoreCategoryMeta: () => api.get<{ category_type: string; image_url?: string | null }[]>("/v1/catalog/store-category-meta"),
};

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient extends Product {
  quantity: number;
}

export interface RecipeWithProducts extends Recipe {
  products: RecipeIngredient[];
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  store_id: string;
  user_id: string;
  user_phone: string;
  rating: number;
  comment: string;
  created_at: string;
}

// ─── Favorites API (backend) ─────────────────────────────────────────────────

export const favoritesApi = {
  getAll: () => api.get<Product[]>("/v1/favorites"),
  add: (productId: string) =>
    api.post<{ ok: boolean }>("/v1/favorites", { product_id: productId }),
  remove: (productId: string) =>
    api.delete<{ ok: boolean }>(`/v1/favorites/${productId}`),
};

export const reviewsApi = {
  getByStore: (storeId: string) =>
    api.get<Review[]>(`/v1/stores/${storeId}/reviews`),

  canReview: (storeId: string) =>
    api.get<{ can_review: boolean }>(`/v1/stores/${storeId}/can-review`),

  add: (storeId: string, rating: number, comment: string) =>
    api.post<Review>(`/v1/stores/${storeId}/reviews`, { rating, comment }),

  deleteOwn: (storeId: string, reviewId: string) =>
    api.delete<{ ok: boolean }>(`/v1/stores/${storeId}/reviews/${reviewId}`),
};

export type OutOfStockAction = "REMOVE" | "REPLACE" | "CALL";

export interface CreateOrderPayload {
  delivery_address: string;
  payment_method: "CASH" | "TRANSFER";
  items: { product_id: string; quantity: number }[];
  comment?: string;
  customer_phone?: string;   // телефон для пикера (и авторизованные, и гости)
  out_of_stock_action?: OutOfStockAction;
  // guest-only (не нужны если есть JWT)
  guest_name?: string;
  guest_phone?: string;
  guest_address?: string;
}

export const ordersApi = {
  getOrders: () => api.get<Order[]>("/v1/orders"),
  getOrder: (id: string) => api.get<Order>(`/v1/orders/${id}`),
  createOrder: (payload: CreateOrderPayload) =>
    api.post<Order>("/v1/orders", payload),
  cancelOrder: (id: string) =>
    api.post<{ message: string }>(`/v1/orders/${id}/cancel`, {}),
};

// ─── Users API ───────────────────────────────────────────────────────────────

export interface UserProfile {
  user_id: string;
  name: string;
  email?: string;
  address?: string;
}

export const usersApi = {
  getProfile: () => api.get<UserProfile>("/v1/users/profile"),
  updateProfile: (data: { name: string; email?: string; address?: string }) =>
    api.put<UserProfile>("/v1/users/profile", data),
};

// ─── Admin API (JWT + ADMIN role) ────────────────────────────────────────────

export const adminApi = {
  updateProduct: (
    id: string,
    payload: { name: string; price: number; description?: string; is_available: boolean }
  ) => api.patch<Product>(`/v1/catalog/products/${id}`, payload),

  updateStore: (
    id: string,
    payload: { name: string; address: string; description?: string; opens_at?: string; closes_at?: string }
  ) => api.patch<Store>(`/v1/stores/${id}`, payload),

  deleteReview: (storeId: string, reviewId: string) =>
    api.delete<{ ok: boolean }>(`/v1/stores/${storeId}/reviews/${reviewId}`),
};

// ─── Auth types (зеркало Go-структур) ───────────────────────────────────────

export interface AuthUser {
  id: string;
  phone: string;
  role: string;
  store_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  /** Запрос OTP-кода (SMS.RU). POST /api/v1/auth/request-code */
  requestCode: (phone: string) =>
    api.post<{ message: string }>("/v1/auth/request-code", { phone }),

  /**
   * Регистрация нового клиента. POST /api/v1/auth/register
   * Требует: phone, code (из SMS), role всегда "CLIENT".
   */
  register: (phone: string, code: string) =>
    api.post<AuthResponse>("/v1/auth/register", {
      phone,
      code,
      role: "CLIENT",
    }),

  /**
   * Верификация OTP для уже зарегистрированного пользователя. POST /api/v1/auth/verify-code
   * Если пользователь не найден → бэкенд вернёт ошибку "пользователь не зарегистрирован".
   */
  verifyCode: (phone: string, code: string) =>
    api.post<AuthResponse>("/v1/auth/verify-code", { phone, code }),

  /** Получить текущего пользователя по токену. GET /api/v1/auth/me */
  me: () => api.get<AuthUser>("/v1/auth/me"),
};
