import { createAdminClient, publicClient } from "./client";
import type {
  Category,
  DashboardStats,
  FeaturedItem,
  Product,
  Recipe,
  RecipeWithProducts,
  Store,
  Subcategory,
} from "../types";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const fetchDashboardStats = async (user: string, password: string) => {
  const { data } = await createAdminClient(user, password).get<DashboardStats>("/dashboard/stats");
  return data;
};

// ─── Stores ───────────────────────────────────────────────────────────────────

// Публичный список магазинов (только активные) — для дропдаунов в админ-панели.
export const fetchStores = async (): Promise<Store[]> => {
  const { data } = await publicClient.get<Store[]>("/stores");
  return data ?? [];
};

// Список магазинов для админки, включая архивные.
export const fetchAdminStores = async (user: string, password: string): Promise<Store[]> => {
  const { data } = await createAdminClient(user, password).get<Store[]>("/stores");
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

export const updateStore = async (
  user: string,
  password: string,
  storeId: string,
  payload: { name: string; address: string; city: string; description?: string; category_type: string }
) => {
  await createAdminClient(user, password).patch(`/stores/${storeId}`, payload);
};

export const uploadStoreImage = async (
  user: string,
  password: string,
  storeId: string,
  image: File
): Promise<{ image_url: string }> => {
  const form = new FormData();
  form.append("image", image);
  const { data } = await createAdminClient(user, password).patch<{ image_url: string }>(
    `/stores/${storeId}/image`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

// DeleteStoreConflict — 409 от бэка, когда у магазина есть заказы/сборщики и физическое удаление невозможно.
export type DeleteStoreConflict = {
  code: "store_has_dependencies";
  orders: number;
  pickers: number;
  hint?: string;
};

export const deleteStore = async (user: string, password: string, storeId: string) => {
  await createAdminClient(user, password).delete(`/stores/${storeId}`);
};

export const archiveStore = async (user: string, password: string, storeId: string) => {
  await createAdminClient(user, password).post(`/stores/${storeId}/archive`);
};

export const restoreStore = async (user: string, password: string, storeId: string) => {
  await createAdminClient(user, password).post(`/stores/${storeId}/restore`);
};

// ─── Опции товара (variant/flag) ──────────────────────────────────────────────

export type OptionValue = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number | null;
  is_default: boolean;
  position: number;
};

export type OptionGroup = {
  id: string;
  product_id: string;
  name: string;
  kind: "variant" | "flag";
  is_required: boolean;
  position: number;
  values: OptionValue[];
};

export const fetchProductOptionGroups = async (
  user: string,
  password: string,
  productId: string
): Promise<OptionGroup[]> => {
  const { data } = await createAdminClient(user, password).get<OptionGroup[]>(
    `/products/${productId}/option-groups`
  );
  return data ?? [];
};

export const createOptionGroup = async (
  user: string,
  password: string,
  productId: string,
  payload: { name: string; kind: "variant" | "flag"; is_required?: boolean }
): Promise<OptionGroup> => {
  const { data } = await createAdminClient(user, password).post<OptionGroup>(
    `/products/${productId}/option-groups`,
    payload
  );
  return data;
};

export const deleteOptionGroup = async (user: string, password: string, groupId: string) => {
  await createAdminClient(user, password).delete(`/option-groups/${groupId}`);
};

export const createOptionValue = async (
  user: string,
  password: string,
  groupId: string,
  payload: { name: string; price_delta?: number | null; is_default?: boolean }
): Promise<OptionValue> => {
  const { data } = await createAdminClient(user, password).post<OptionValue>(
    `/option-groups/${groupId}/values`,
    payload
  );
  return data;
};

export const deleteOptionValue = async (user: string, password: string, valueId: string) => {
  await createAdminClient(user, password).delete(`/option-values/${valueId}`);
};

// ─── Store subcategories (магазин-локальные категории) ────────────────────────

// Двухуровневая категория магазина: parent_id = null — категория верхнего уровня,
// parent_id заполнен — подкатегория внутри категории parent_id.
export type StoreSubcategory = {
  id: string;
  category_id?: string | null;
  store_id?: string | null;
  parent_id?: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  products_count: number;
};

export const fetchStoreSubcategories = async (
  user: string,
  password: string,
  storeId: string
): Promise<StoreSubcategory[]> => {
  const { data } = await createAdminClient(user, password).get<StoreSubcategory[]>(
    `/stores/${storeId}/subcategories`
  );
  return data ?? [];
};

// parentId задан — создаётся подкатегория второго уровня внутри категории parentId.
export const createStoreSubcategory = async (
  user: string,
  password: string,
  storeId: string,
  name: string,
  parentId?: string | null
): Promise<StoreSubcategory> => {
  const { data } = await createAdminClient(user, password).post<StoreSubcategory>(
    `/stores/${storeId}/subcategories`,
    { name, parent_id: parentId ?? null }
  );
  return data;
};

export const updateStoreSubcategory = async (
  user: string,
  password: string,
  storeId: string,
  subId: string,
  name: string
): Promise<void> => {
  await createAdminClient(user, password).patch(`/stores/${storeId}/subcategories/${subId}`, { name });
};

export const deleteStoreSubcategory = async (
  user: string,
  password: string,
  storeId: string,
  subId: string
) => {
  await createAdminClient(user, password).delete(`/stores/${storeId}/subcategories/${subId}`);
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

export const updateCategory = async (
  user: string,
  password: string,
  categoryId: string,
  name: string
): Promise<void> => {
  await createAdminClient(user, password).patch(`/categories/${categoryId}`, { name });
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

export type StoreCategoryMeta = { category_type: string; name?: string | null; description?: string | null; image_url?: string | null };

export const fetchStoreCategoryMeta = async (): Promise<StoreCategoryMeta[]> => {
  const { data } = await publicClient.get<StoreCategoryMeta[]>("/catalog/store-category-meta");
  return data ?? [];
};

export const updateStoreCategoryMeta = async (
  user: string,
  password: string,
  categoryType: string,
  name: string,
  description: string
): Promise<void> => {
  await createAdminClient(user, password).patch(`/store-category-meta/${categoryType}`, { name, description });
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

export const createStoreCategory = async (
  user: string,
  password: string,
  name: string,
  image?: File | null
): Promise<StoreCategoryMeta> => {
  const form = new FormData();
  form.append("name", name);
  if (image) form.append("image", image);
  const { data } = await createAdminClient(user, password).post<StoreCategoryMeta>(
    "/store-categories",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

export const deleteStoreCategory = async (user: string, password: string, categoryType: string) => {
  await createAdminClient(user, password).delete(`/store-categories/${categoryType}`);
};

export const deleteCategory = async (user: string, password: string, categoryId: string) => {
  await createAdminClient(user, password).delete(`/categories/${categoryId}`);
};

// ─── Подкатегории товаров (глобальные, привязаны к категории) ──────────────────

// Публичный список подкатегорий категории — для зависимых дропдаунов в форме товара.
export const fetchSubcategories = async (categoryId: string): Promise<Subcategory[]> => {
  const { data } = await publicClient.get<Subcategory[]>(
    `/catalog/subcategories?category_id=${categoryId}`
  );
  return data ?? [];
};

export const createSubcategory = async (
  user: string,
  password: string,
  categoryId: string,
  name: string
): Promise<Subcategory> => {
  const { data } = await createAdminClient(user, password).post<Subcategory>(
    `/categories/${categoryId}/subcategories`,
    { name }
  );
  return data;
};

export const updateSubcategory = async (
  user: string,
  password: string,
  subcategoryId: string,
  name: string
): Promise<void> => {
  await createAdminClient(user, password).patch(`/subcategories/${subcategoryId}`, { name });
};

export const deleteSubcategory = async (user: string, password: string, subcategoryId: string) => {
  await createAdminClient(user, password).delete(`/subcategories/${subcategoryId}`);
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
    category_id?: string;
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
  if (payload.category_id) form.append("category_id", payload.category_id);
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
  payload: {
    name?: string;
    price?: number;
    description?: string;
    is_available?: boolean;
    category_id?: string;
    // subcategory_id: непустая строка — привязка, "" — явный сброс в NULL.
    subcategory_id?: string;
    image?: File | null;
  }
) => {
  const form = new FormData();
  if (payload.name !== undefined) form.append("name", payload.name);
  if (payload.price !== undefined) form.append("price", String(payload.price));
  if (payload.description !== undefined) form.append("description", payload.description);
  if (payload.is_available !== undefined) form.append("is_available", String(payload.is_available));
  if (payload.category_id) form.append("category_id", payload.category_id);
  if (payload.subcategory_id !== undefined) form.append("subcategory_id", payload.subcategory_id);
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
  // /catalog/products отдаёт пагинированный ответ { data, total, ... } —
  // достаём массив, но поддерживаем и «голый» массив на случай старого формата.
  const { data } = await publicClient.get(
    `/catalog/products?search=${encodeURIComponent(query)}&available_only=true`
  );
  if (Array.isArray(data)) return data;
  return data?.data ?? [];
};

export const searchStoreProducts = async (
  storeId: string,
  query: string
): Promise<Product[]> => {
  // Бэкенд теперь возвращает {data, total, page, limit, has_more}
  const { data } = await publicClient.get<{ data: Product[] }>(
    `/stores/${storeId}/products?search=${encodeURIComponent(query)}&limit=50`
  );
  return data?.data ?? [];
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

// ─── Pickers ──────────────────────────────────────────────────────────────────

export type Picker = {
  id: string;
  phone: string;
  store_id: string;
  store_name: string;
  created_at: string;
};

export const fetchPickers = async (user: string, password: string): Promise<Picker[]> => {
  const { data } = await createAdminClient(user, password).get<Picker[]>("/pickers");
  return data ?? [];
};

export const createPicker = async (
  user: string,
  password: string,
  payload: { phone: string; password: string; store_id: string }
): Promise<Picker> => {
  const { data } = await createAdminClient(user, password).post<Picker>("/pickers", payload);
  return data;
};

export const updatePicker = async (
  user: string,
  password: string,
  id: string,
  payload: { store_id: string }
) => {
  await createAdminClient(user, password).patch(`/pickers/${id}`, payload);
};

export const updatePickerPassword = async (
  user: string,
  password: string,
  id: string,
  newPassword: string
) => {
  await createAdminClient(user, password).patch(`/pickers/${id}/password`, {
    password: newPassword,
  });
};

export const deletePicker = async (user: string, password: string, id: string) => {
  await createAdminClient(user, password).delete(`/pickers/${id}`);
};
