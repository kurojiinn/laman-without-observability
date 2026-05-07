import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogApi, ordersApi, usersApi, favoritesApi, reviewsApi } from "./api";
import type {
  Category, Subcategory, Product, Store, Scenario, RecipeWithProducts,
  UserProfile, Order, Review,
} from "./api";

// Централизованная фабрика ключей кеша.
// Ключи иерархичны — invalidate({queryKey: ['products']}) инвалидирует
// все варианты с разными фильтрами одновременно.
export const queryKeys = {
  categories: ["categories"] as const,
  subcategories: (categoryId: string) => ["subcategories", categoryId] as const,
  products: (params?: { category_id?: string; subcategory_id?: string; search?: string }) =>
    ["products", params ?? {}] as const,
  stores: (search?: string) => ["stores", search ?? ""] as const,
  store: (id: string) => ["store", id] as const,
  storeProducts: (storeId: string, params?: { search?: string; subcategory_id?: string; sort?: string }) =>
    ["store-products", storeId, params ?? {}] as const,
  storeSubcategories: (storeId: string) => ["store-subcategories", storeId] as const,
  featured: (block: string) => ["featured", block] as const,
  scenarios: ["scenarios"] as const,
  recipes: ["recipes"] as const,
  recipe: (id: string) => ["recipe", id] as const,
  storeCategoryMeta: ["store-category-meta"] as const,
  profile: ["profile"] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["order", id] as const,
  favorites: ["favorites"] as const,
  reviews: (storeId: string) => ["reviews", storeId] as const,
  canReview: (storeId: string) => ["can-review", storeId] as const,
};

// ── Каталог ─────────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => catalogApi.getCategories(),
    // Категории — справочник, меняются редко; держим долго
    staleTime: 10 * 60_000,
  });
}

export function useSubcategories(categoryId: string | null) {
  return useQuery({
    queryKey: queryKeys.subcategories(categoryId ?? ""),
    queryFn: () => catalogApi.getSubcategories(categoryId!),
    enabled: !!categoryId,
    staleTime: 10 * 60_000,
  });
}

export function useProducts(params?: { category_id?: string; subcategory_id?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => catalogApi.getProducts(params),
  });
}

export function useStores(search?: string) {
  return useQuery({
    queryKey: queryKeys.stores(search),
    queryFn: () => catalogApi.getStores(search ? { search } : undefined),
    staleTime: 5 * 60_000,
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.store(id ?? ""),
    queryFn: () => catalogApi.getStore(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useStoreProducts(
  storeId: string | undefined,
  params?: { search?: string; subcategory_id?: string; sort?: string }
) {
  return useQuery({
    queryKey: queryKeys.storeProducts(storeId ?? "", params),
    queryFn: () => catalogApi.getStoreProducts(storeId!, params),
    enabled: !!storeId,
  });
}

export function useStoreSubcategories(storeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.storeSubcategories(storeId ?? ""),
    queryFn: () => catalogApi.getStoreSubcategories(storeId!),
    enabled: !!storeId,
    staleTime: 10 * 60_000,
  });
}

export function useFeatured(block: "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook") {
  return useQuery({
    queryKey: queryKeys.featured(block),
    queryFn: () => catalogApi.getFeatured(block),
    staleTime: 5 * 60_000,
  });
}

export function useScenarios() {
  return useQuery({
    queryKey: queryKeys.scenarios,
    queryFn: () => catalogApi.getScenarios(),
    staleTime: 10 * 60_000,
  });
}

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: () => catalogApi.getRecipes(),
    staleTime: 10 * 60_000,
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.recipe(id ?? ""),
    queryFn: () => catalogApi.getRecipe(id!),
    enabled: !!id,
    staleTime: 10 * 60_000,
  });
}

export function useStoreCategoryMeta() {
  return useQuery({
    queryKey: queryKeys.storeCategoryMeta,
    queryFn: () => catalogApi.getStoreCategoryMeta(),
    staleTime: 30 * 60_000,
  });
}

// ── Профиль / Заказы ────────────────────────────────────────────────────────

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => usersApi.getProfile(),
    enabled,
  });
}

export function useOrders(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: () => ordersApi.getOrders(),
    enabled,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(id ?? ""),
    queryFn: () => ordersApi.getOrder(id!),
    enabled: !!id,
  });
}

// ── Избранное ──────────────────────────────────────────────────────────────

export function useFavorites(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.favorites,
    queryFn: () => favoritesApi.getAll(),
    enabled,
  });
}

// ── Отзывы ──────────────────────────────────────────────────────────────────

export function useStoreReviews(storeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews(storeId ?? ""),
    queryFn: () => reviewsApi.getByStore(storeId!),
    enabled: !!storeId,
  });
}

export function useCanReview(storeId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.canReview(storeId ?? ""),
    queryFn: () => reviewsApi.canReview(storeId!),
    enabled: !!storeId && enabled,
  });
}

// ── Mutations с optimistic updates ────────────────────────────────────────

/** Хелпер: инвалидирует все списочные queries после мутации. */
export function useInvalidateOnMutation() {
  const qc = useQueryClient();
  return {
    invalidateOrders: () => qc.invalidateQueries({ queryKey: queryKeys.orders }),
    invalidateFavorites: () => qc.invalidateQueries({ queryKey: queryKeys.favorites }),
    invalidateReviews: (storeId: string) =>
      qc.invalidateQueries({ queryKey: queryKeys.reviews(storeId) }),
    invalidateProfile: () => qc.invalidateQueries({ queryKey: queryKeys.profile }),
    invalidateStores: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  };
}

// Re-export типов чтобы потребители могли импортировать всё из одного места
export type {
  Category, Subcategory, Product, Store, Scenario, RecipeWithProducts,
  UserProfile, Order, Review,
};
