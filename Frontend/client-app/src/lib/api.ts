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

/**
 * Размеры под imgproxy. Подобраны под фактические размеры контейнеров в UI:
 *  - thumb: миниатюры в корзине, ингредиенты рецептов, store avatar (~80px)
 *  - card:  карточки товаров в каталоге/магазинах/избранном (~400px)
 *  - hero:  фоны сценариев, рецептов на главной (~800px)
 *  - full:  ProductModal во весь экран (~1200px)
 *
 * Все варианты берут квадратный crop (resize:fill) — это совпадает с aspect-square
 * во всех карточках. Если нужно другое отношение — добавим отдельные пресеты.
 */
export type ImgSize = "thumb" | "card" | "hero" | "full";

const IMG_SIZES: Record<ImgSize, number> = {
  thumb: 160,  // x2 для retina на 80px контейнере
  card: 600,   // x1.5 для retina на 400px контейнере
  hero: 1200,
  full: 1600,
};

// Нормализует image_url из БД.
// MinIO URL (/laman-images/...) — без size возвращается оригинал, с size — через imgproxy.
// Старые /uploads/ URL тоже корректируются на текущий API-хост.
export function resolveImageUrl(url: string | undefined | null, size?: ImgSize): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/laman-images/")) {
      // NEXT_PUBLIC_MINIO_URL задаётся явно для локального dev (localhost:3000 ≠ nginx).
      // В Docker window.location.origin уже указывает на nginx, переменная там не нужна.
      const host = typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_MINIO_URL || "http://localhost:9000");

      if (size) {
        // imgproxy: /img/insecure/resize:fill:600:600:0/plain/laman-images/abc.jpg
        // BASE_URL=http://minio:9000/ задан в docker-compose, путь относительный
        const px = IMG_SIZES[size];
        const sourcePath = parsed.pathname.replace(/^\//, "");
        return `${host}/img/insecure/resize:fill:${px}:${px}:0/plain/${sourcePath}`;
      }

      const minioHost = typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_MINIO_URL || window.location.origin)
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

// Узел двухуровневого дерева категорий магазина (GET /stores/:id/category-tree).
// Узел верхнего уровня может иметь children; узел второго уровня — лист.
// id любого узла можно передать как subcategory_id в getStoreProducts —
// бэкенд развернёт его в дочерние подкатегории при необходимости.
export interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
}

export interface ProductOptionValue {
  id: string;
  group_id: string;
  name: string;
  price_delta: number | null;
  is_default: boolean;
  position: number;
}

export interface ProductOptionGroup {
  id: string;
  product_id: string;
  name: string;
  kind: "variant" | "flag";
  is_required: boolean;
  position: number;
  values: ProductOptionValue[];
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
  option_groups?: ProductOptionGroup[];
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
  category_type: string | null;
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

// Стандартный формат ответа списочных эндпоинтов.
// Frontend компоненты могут принимать как пагинированный, так и обычный массив
// — useInfiniteQuery собирает все страницы в один список.
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export const catalogApi = {
  getCategories: () => api.get<Category[]>("/v1/catalog/categories"),

  getSubcategories: (categoryId: string) =>
    api.get<Subcategory[]>(`/v1/catalog/subcategories?category_id=${categoryId}`),

  getProducts: (params?: { category_id?: string; subcategory_id?: string; search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.subcategory_id) q.set("subcategory_id", params.subcategory_id);
    if (params?.search) q.set("search", params.search);
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    q.set("available_only", "true");
    return api.get<Paginated<Product>>(`/v1/catalog/products?${q}`);
  },

  getStores: (params?: { search?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    return api.get<Store[]>(`/v1/stores?${q}`);
  },

  getStore: (id: string) => api.get<Store>(`/v1/stores/${id}`),

  getStoreSubcategories: (storeId: string) =>
    api.get<Subcategory[]>(`/v1/stores/${storeId}/subcategories`),

  getStoreCategoryTree: (storeId: string) =>
    api.get<CategoryNode[]>(`/v1/stores/${storeId}/category-tree`),

  getStoreProducts: (storeId: string, params?: { search?: string; category_id?: string; subcategory_id?: string; sort?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    q.set("available_only", "true");
    if (params?.search) q.set("search", params.search);
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.subcategory_id) q.set("subcategory_id", params.subcategory_id);
    if (params?.sort) q.set("sort", params.sort);
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    return api.get<Paginated<Product>>(`/v1/stores/${storeId}/products?${q}`);
  },

  getFeatured: (block: "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook") =>
    api.get<Product[]>(`/v1/catalog/featured?block=${block}`),

  getRecipes: () => api.get<RecipeWithProducts[]>("/v1/catalog/recipes"),
  getRecipe: (id: string) => api.get<RecipeWithProducts>(`/v1/catalog/recipes/${id}`),
  getScenarios: () => api.get<Scenario[]>("/v1/catalog/scenarios"),
  getStoreCategoryMeta: () => api.get<{ category_type: string; name?: string | null; description?: string | null; image_url?: string | null }[]>("/v1/catalog/store-category-meta"),
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
  items: { product_id: string; quantity: number; selected_options?: string[] }[];
  comment?: string;
  customer_phone?: string;   // телефон для пикера (и авторизованные, и гости)
  out_of_stock_action?: OutOfStockAction;
  delivery_type?: "now" | "scheduled" | "express";
  scheduled_at?: string | null;
  delivery_surcharge?: number;
}

export const ordersApi = {
  getOrders: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    const qs = q.toString();
    return api.get<Paginated<Order>>(`/v1/orders${qs ? `?${qs}` : ""}`);
  },
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

  // Загружает новое фото товара. Делает прямой fetch с FormData — обычный
  // api-обёртка форсит JSON Content-Type, для multipart его нужно опустить,
  // чтобы браузер выставил с правильным boundary.
  uploadProductImage: async (id: string, file: File): Promise<Product> => {
    const form = new FormData();
    form.append("image", file);
    const headers: Record<string, string> = {};
    const token = tokenStore.get();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${getBaseUrl()}/v1/catalog/products/${id}/image`, {
      method: "PATCH",
      body: form,
      credentials: "include",
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(
        (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`
      );
    }
    return res.json() as Promise<Product>;
  },

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
  phone: string;       // пустая строка для email-пользователей
  email?: string;      // заполнен для email-пользователей
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
  /** Регистрация по email + пароль. POST /api/v1/auth/register */
  registerWithEmail: (email: string, password: string) =>
    api.post<{ message: string }>("/v1/auth/register", { email, password }),

  /** Подтверждение email OTP. POST /api/v1/auth/verify-email */
  verifyEmail: (email: string, code: string) =>
    api.post<AuthResponse>("/v1/auth/verify-email", { email, code }),

  /** Вход по email + пароль. POST /api/v1/auth/login */
  loginWithEmail: (email: string, password: string) =>
    api.post<AuthResponse>("/v1/auth/login", { email, password }),

  /** Проверить, зарегистрирован ли email. GET /api/v1/auth/check-user?email= */
  checkUser: (email: string) =>
    api.get<{ exists: boolean }>(`/v1/auth/check-user?email=${encodeURIComponent(email)}`),

  /** Выход из аккаунта. POST /api/v1/auth/logout */
  logout: () => api.post<void>("/v1/auth/logout", {}),

  /** Получить текущего пользователя по токену. GET /api/v1/auth/me */
  me: () => api.get<AuthUser & { token: string }>("/v1/auth/me"),
};
