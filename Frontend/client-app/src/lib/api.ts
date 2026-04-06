const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { ...getAuthHeaders(), ...options.headers },
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
  phone?: string;
  description?: string;
  image_url?: string;
  rating: number;
  category_type: string;
  lat?: number;
  lng?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
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

export const catalogApi = {
  getCategories: () => api.get<Category[]>("/v1/catalog/categories"),

  getProducts: (params?: { category_id?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.category_id) q.set("category_id", params.category_id);
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

  getStoreProducts: (storeId: string, params?: { search?: string }) => {
    const q = new URLSearchParams();
    q.set("available_only", "true");
    if (params?.search) q.set("search", params.search);
    return api.get<Product[]>(`/v1/stores/${storeId}/products?${q}`);
  },
};

// ─── Reviews (localStorage) ──────────────────────────────────────────────────

export interface Review {
  id: string;
  store_id: string;
  user_phone: string;
  rating: number;
  comment: string;
  created_at: string;
}

const REVIEWS_KEY = "laman_reviews";

function loadReviews(): Review[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? "[]") as Review[];
  } catch {
    return [];
  }
}

function saveReviews(reviews: Review[]) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
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
  getByStore: (storeId: string): Review[] =>
    loadReviews().filter((r) => r.store_id === storeId),

  add: (review: Omit<Review, "id" | "created_at">): Review => {
    const all = loadReviews();
    const newReview: Review = {
      ...review,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    saveReviews([newReview, ...all]);
    return newReview;
  },
};

export interface CreateOrderPayload {
  delivery_address: string;
  payment_method: "CASH" | "TRANSFER";
  items: { product_id: string; quantity: number }[];
  comment?: string;
  customer_phone?: string;   // телефон для пикера (и авторизованные, и гости)
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
