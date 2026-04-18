import { createAdminClient, publicClient } from "./client";
import type {
  Category,
  DashboardStats,
  FeaturedItem,
  Product,
  Recipe,
  RecipeWithProducts,
  Store,
} from "../types";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const fetchDashboardStats = async (user: string, password: string) => {
  const { data } = await createAdminClient(user, password).get<DashboardStats>("/dashboard/stats");
  return data;
};

// ─── Stores ───────────────────────────────────────────────────────────────────

export const fetchStores = async (): Promise<Store[]> => {
  const { data } = await publicClient.get<Store[]>("/stores");
  return data ?? [];
};

export const createStore = async (
  user: string,
  password: string,
  payload: { name: string; address: string; city: string; category_type: string; description?: string }
) => {
  const { data } = await createAdminClient(user, password).post<Store>("/stores", payload);
  return data;
};

export const deleteStore = async (user: string, password: string, storeId: string) => {
  await createAdminClient(user, password).delete(`/stores/${storeId}`);
};

// ─── Products ─────────────────────────────────────────────────────────────────

export const fetchCategories = async (): Promise<Category[]> => {
  const { data } = await publicClient.get<Category[]>("/catalog/categories");
  return data ?? [];
};

export const fetchAdminCategories = async (user: string, password: string): Promise<Category[]> => {
  const { data } = await createAdminClient(user, password).get<Category[]>("/categories");
  return data ?? [];
};

export const createCategory = async (
  user: string,
  password: string,
  name: string,
  image?: File | null
): Promise<Category> => {
  const form = new FormData();
  form.append("name", name);
  if (image) form.append("image", image);
  const { data } = await createAdminClient(user, password).post<Category>("/categories", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateCategoryImage = async (
  user: string,
  password: string,
  categoryId: string,
  image: File
): Promise<{ image_url: string }> => {
  const form = new FormData();
  form.append("image", image);
  const { data } = await createAdminClient(user, password).patch<{ image_url: string }>(
    `/categories/${categoryId}/image`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

// ─── Store category meta (фоны типов магазинов) ───────────────────────────────

export type StoreCategoryMeta = { category_type: string; image_url?: string | null };

export const fetchStoreCategoryMeta = async (): Promise<StoreCategoryMeta[]> => {
  const { data } = await publicClient.get<StoreCategoryMeta[]>("/catalog/store-category-meta");
  return data ?? [];
};

export const updateStoreCategoryImage = async (
  user: string,
  password: string,
  categoryType: string,
  image: File
): Promise<{ image_url: string }> => {
  const form = new FormData();
  form.append("image", image);
  const { data } = await createAdminClient(user, password).patch<{ image_url: string }>(
    `/store-category-meta/${categoryType}/image`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

export const deleteCategory = async (user: string, password: string, categoryId: string) => {
  await createAdminClient(user, password).delete(`/categories/${categoryId}`);
};

export const fetchProducts = async (user: string, password: string, storeId: string): Promise<Product[]> => {
  const { data } = await createAdminClient(user, password).get<Product[]>(`/products?store_id=${storeId}`);
  return data ?? [];
};

export const createProduct = async (
  user: string,
  password: string,
  payload: {
    store_id: string;
    category_id: string;
    subcategory_id?: string;
    name: string;
    description?: string;
    price: number;
    weight?: number;
    is_available?: boolean;
    image?: File | null;
  }
) => {
  const form = new FormData();
  form.append("store_id", payload.store_id);
  form.append("category_id", payload.category_id);
  if (payload.subcategory_id) form.append("subcategory_id", payload.subcategory_id);
  form.append("name", payload.name);
  if (payload.description) form.append("description", payload.description);
  form.append("price", String(payload.price));
  if (payload.weight !== undefined) form.append("weight", String(payload.weight));
  form.append("is_available", String(payload.is_available ?? true));
  if (payload.image) form.append("image", payload.image);
  const { data } = await createAdminClient(user, password).post<Product>("/products", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateProduct = async (
  user: string,
  password: string,
  productId: string,
  payload: { name?: string; price?: number; description?: string; is_available?: boolean; image?: File | null }
) => {
  const form = new FormData();
  if (payload.name !== undefined) form.append("name", payload.name);
  if (payload.price !== undefined) form.append("price", String(payload.price));
  if (payload.description !== undefined) form.append("description", payload.description);
  if (payload.is_available !== undefined) form.append("is_available", String(payload.is_available));
  if (payload.image) form.append("image", payload.image);
  const { data } = await createAdminClient(user, password).patch<Product>(`/products/${productId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deleteProduct = async (user: string, password: string, productId: string) => {
  await createAdminClient(user, password).delete(`/products/${productId}`);
};

export const importProducts = async (user: string, password: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await createAdminClient(user, password).post("/products/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const searchProductsByName = async (
  query: string
): Promise<{ id: string; name: string; price: number; store_id: string }[]> => {
  const { data } = await publicClient.get(
    `/catalog/products?search=${encodeURIComponent(query)}&available_only=true`
  );
  return data ?? [];
};

export const searchStoreProducts = async (
  storeId: string,
  query: string
): Promise<Product[]> => {
  const { data } = await publicClient.get<Product[]>(
    `/stores/${storeId}/products?search=${encodeURIComponent(query)}`
  );
  return data ?? [];
};

// ─── Featured / Витрина ───────────────────────────────────────────────────────

export const fetchFeatured = async (user: string, password: string, block: string): Promise<FeaturedItem[]> => {
  const { data } = await createAdminClient(user, password).get<FeaturedItem[]>(`/featured?block=${block}`);
  return data ?? [];
};

export const fetchFeaturedProducts = async (block: string): Promise<Product[]> => {
  const { data } = await publicClient.get<Product[]>(`/catalog/featured?block=${block}`);
  return data ?? [];
};

export const addFeatured = async (
  user: string,
  password: string,
  payload: { product_id: string; block_type: string; position: number }
) => {
  const { data } = await createAdminClient(user, password).post("/featured", payload);
  return data;
};

export const deleteFeatured = async (user: string, password: string, id: string) => {
  await createAdminClient(user, password).delete(`/featured/${id}`);
};

// ─── Orders ───────────────────────────────────────────────────────────────────

export const fetchAllOrders = async (user: string, password: string) => {
  const { data } = await createAdminClient(user, password).get("/orders");
  return data;
};

export const updateOrderStatusAdmin = async (
  user: string,
  password: string,
  orderId: string,
  status: string
) => {
  const { data } = await createAdminClient(user, password).patch(`/orders/${orderId}`, { status });
  return data;
};

// ─── Recipes ──────────────────────────────────────────────────────────────────

export const fetchRecipes = async (user: string, password: string): Promise<Recipe[]> => {
  const { data } = await createAdminClient(user, password).get<Recipe[]>("/recipes");
  return data ?? [];
};

export const fetchRecipe = async (user: string, password: string, id: string): Promise<RecipeWithProducts> => {
  const { data } = await createAdminClient(user, password).get<RecipeWithProducts>(`/recipes/${id}`);
  return data;
};

export const createRecipe = async (
  user: string,
  password: string,
  payload: { store_id?: string; name: string; description?: string; image_url?: string; position?: number }
): Promise<Recipe> => {
  const { data } = await createAdminClient(user, password).post<Recipe>("/recipes", payload);
  return data;
};

export const updateRecipe = async (
  user: string,
  password: string,
  id: string,
  payload: { name: string; description?: string; image_url?: string; position?: number }
): Promise<Recipe> => {
  const { data } = await createAdminClient(user, password).patch<Recipe>(`/recipes/${id}`, payload);
  return data;
};

export const deleteRecipe = async (user: string, password: string, id: string) => {
  await createAdminClient(user, password).delete(`/recipes/${id}`);
};

export const addRecipeProduct = async (
  user: string,
  password: string,
  recipeId: string,
  productId: string,
  quantity: number
) => {
  await createAdminClient(user, password).post(`/recipes/${recipeId}/products`, {
    product_id: productId,
    quantity,
  });
};

export const removeRecipeProduct = async (
  user: string,
  password: string,
  recipeId: string,
  productId: string
) => {
  await createAdminClient(user, password).delete(`/recipes/${recipeId}/products/${productId}`);
};

// ─── Scenarios ────────────────────────────────────────────────────────────────

import type { Scenario } from "../types";

export const fetchScenarios = async (user: string, password: string): Promise<Scenario[]> => {
  const { data } = await createAdminClient(user, password).get<Scenario[]>("/scenarios");
  return data ?? [];
};

export const createScenario = async (
  user: string,
  password: string,
  payload: Omit<Scenario, "id" | "created_at" | "updated_at">
): Promise<Scenario> => {
  const { data } = await createAdminClient(user, password).post<Scenario>("/scenarios", payload);
  return data;
};

export const updateScenario = async (
  user: string,
  password: string,
  id: string,
  payload: Omit<Scenario, "id" | "created_at" | "updated_at">
): Promise<Scenario> => {
  const { data } = await createAdminClient(user, password).patch<Scenario>(`/scenarios/${id}`, payload);
  return data;
};

export const deleteScenario = async (user: string, password: string, id: string) => {
  await createAdminClient(user, password).delete(`/scenarios/${id}`);
};
