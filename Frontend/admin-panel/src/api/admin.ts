import { createAdminClient, publicClient } from "./client";
import type { Category, DashboardStats, Store } from "../types";

export const fetchDashboardStats = async (user: string, password: string) => {
  const client = createAdminClient(user, password);
  const { data } = await client.get<DashboardStats>("/dashboard/stats");
  return data;
};

export const createStore = async (
  user: string,
  password: string,
  payload: {
    name: string;
    address: string;
    category_type: string;
    description?: string;
  }
) => {
  const client = createAdminClient(user, password);
  const { data } = await client.post("/stores", payload);
  return data;
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
  const client = createAdminClient(user, password);
  const formData = new FormData();
  formData.append("store_id", payload.store_id);
  formData.append("category_id", payload.category_id);
  if (payload.subcategory_id) {
    formData.append("subcategory_id", payload.subcategory_id);
  }
  formData.append("name", payload.name);
  if (payload.description) {
    formData.append("description", payload.description);
  }
  formData.append("price", String(payload.price));
  if (payload.weight !== undefined) {
    formData.append("weight", String(payload.weight));
  }
  if (payload.is_available !== undefined) {
    formData.append("is_available", String(payload.is_available));
  }
  if (payload.image) {
    formData.append("image", payload.image);
  }

  const { data } = await client.post("/products", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const importProducts = async (user: string, password: string, file: File) => {
  const client = createAdminClient(user, password);
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post("/products/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const fetchActiveOrders = async (user: string, password: string) => {
  const client = createAdminClient(user, password);
  const { data } = await client.get("/orders/active");
  return data;
};

export const deleteStore = async (user: string, password: string, storeId: string) => {
  const client = createAdminClient(user, password);
  const { data } = await client.delete(`/stores/${storeId}`);
  return data;
};

export const deleteProduct = async (user: string, password: string, productId: string) => {
  const client = createAdminClient(user, password);
  const { data } = await client.delete(`/products/${productId}`);
  return data;
};

export const updateOrderStatusAdmin = async (
  user: string,
  password: string,
  orderId: string,
  status: string
) => {
  const client = createAdminClient(user, password);
  const { data } = await client.patch(`/orders/${orderId}`, { status });
  return data;
};

export const fetchStores = async () => {
  const { data } = await publicClient.get<Store[]>("/stores");
  return data;
};

export const fetchCategories = async () => {
  const { data } = await publicClient.get<Category[]>("/catalog/categories");
  return data;
};

export const fetchProducts = async (user: string, password: string, storeId: string) => {
  const client = createAdminClient(user, password);
  const { data } = await client.get(`/products?store_id=${storeId}`);
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
    image?: File | null;
  }
) => {
  const client = createAdminClient(user, password);
  const formData = new FormData();
  if (payload.name !== undefined) formData.append("name", payload.name);
  if (payload.price !== undefined) formData.append("price", String(payload.price));
  if (payload.description !== undefined) formData.append("description", payload.description);
  if (payload.is_available !== undefined) formData.append("is_available", String(payload.is_available));
  if (payload.category_id !== undefined) formData.append("category_id", payload.category_id);
  if (payload.image) formData.append("image", payload.image);
  const { data } = await client.patch(`/products/${productId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};
