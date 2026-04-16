import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFeatured,
  createProduct,
  createStore,
  deleteFeatured,
  deleteProduct,
  deleteStore,
  fetchActiveOrders,
  fetchCategories,
  fetchDashboardStats,
  fetchFeatured,
  fetchProducts,
  fetchStores,
  importProducts,
  searchProductsByName,
  updateOrderStatusAdmin,
  updateProduct,
} from "./api/admin";
import type { AdminOrder, FeaturedBlockType, FeaturedItem, StoreCategoryType } from "./types";
import { FEATURED_BLOCK_LABELS } from "./types";
import { StatCard } from "./components/StatCard";

const categoryOptions: { label: string; value: StoreCategoryType }[] = [
  { label: "🍔 Общепит", value: "FOOD" },
  { label: "👕 Одежда", value: "CLOTHES" },
  { label: "🏠 Быт", value: "HOME" },
  { label: "🏗️ Стройка", value: "BUILDING" },
  { label: "💊 Аптека", value: "PHARMACY" },
];

export const App = () => {
  const queryClient = useQueryClient();
  const [auth, setAuth] = useState(() => ({
    user: localStorage.getItem("admin_user") ?? "admin",
    password: localStorage.getItem("admin_password") ?? "admin",
  }));
  const [storeForm, setStoreForm] = useState({
    name: "",
    address: "",
    category_type: "FOOD",
    description: "",
  });
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    weight: "",
    is_available: true,
    store_id: "",
    category_id: "",
    subcategory_id: "",
    description: "",
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [deleteProductId, setDeleteProductId] = useState("");
  const [deleteStoreId, setDeleteStoreId] = useState("");
  const [productsStoreId, setProductsStoreId] = useState("");
  const [editingProduct, setEditingProduct] = useState<null | {
    id: string;
    name: string;
    price: number;
    description: string;
    is_available: boolean;
    image_url: string | null;
  }>(null);
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [orderStatusForm, setOrderStatusForm] = useState({
    order_id: "",
    status: "IN_PROGRESS",
  });
  const [featuredBlock, setFeaturedBlock] = useState<FeaturedBlockType>("new_items");
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [featuredProductId, setFeaturedProductId] = useState("");
  const [featuredProductName, setFeaturedProductName] = useState("");
  const [featuredPosition, setFeaturedPosition] = useState("0");
  const [showFeaturedResults, setShowFeaturedResults] = useState(false);

  const canAuth = auth.user.trim().length > 0 && auth.password.trim().length > 0;

  const statsQuery = useQuery({
    queryKey: ["stats", auth.user],
    queryFn: () => fetchDashboardStats(auth.user, auth.password),
    enabled: canAuth,
  });

  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const createStoreMutation = useMutation({
    mutationFn: () =>
      createStore(auth.user, auth.password, {
        name: storeForm.name,
        address: storeForm.address,
        category_type: storeForm.category_type,
        description: storeForm.description || undefined,
      }),
    onSuccess: () => {
      setStoreForm({ name: "", address: "", category_type: "FOOD", description: "" });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: () =>
      createProduct(auth.user, auth.password, {
        name: productForm.name,
        price: Number(productForm.price),
        weight: productForm.weight ? Number(productForm.weight) : undefined,
        store_id: productForm.store_id,
        category_id: productForm.category_id,
        subcategory_id: productForm.subcategory_id || undefined,
        description: productForm.description || undefined,
        is_available: productForm.is_available,
        image: productImage,
      }),
    onSuccess: () => {
      setProductForm({
        name: "",
        price: "",
        weight: "",
        is_available: true,
        store_id: "",
        category_id: "",
        subcategory_id: "",
        description: "",
      });
      setProductImage(null);
      setProductPreview(null);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: () =>
      updateOrderStatusAdmin(
        auth.user,
        auth.password,
        orderStatusForm.order_id,
        orderStatusForm.status
      ),
  });

  const activeOrdersQuery = useQuery<AdminOrder[]>({
    queryKey: ["active-orders", auth.user],
    queryFn: () => fetchActiveOrders(auth.user, auth.password),
    enabled: canAuth,
  });

  const deleteStoreMutation = useMutation({
    mutationFn: () => deleteStore(auth.user, auth.password, deleteStoreId),
    onSuccess: () => {
      setDeleteStoreId("");
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: () => deleteProduct(auth.user, auth.password, deleteProductId),
    onSuccess: () => {
      setDeleteProductId("");
    },
  });

  const productsQuery = useQuery({
    queryKey: ["products", productsStoreId],
    queryFn: () => fetchProducts(auth.user, auth.password, productsStoreId),
    enabled: Boolean(productsStoreId) && canAuth,
  });

  const updateProductMutation = useMutation({
    mutationFn: () => {
      if (!editingProduct) throw new Error("нет товара для редактирования");
      return updateProduct(auth.user, auth.password, editingProduct.id, {
        name: editingProduct.name,
        price: editingProduct.price,
        description: editingProduct.description,
        is_available: editingProduct.is_available,
        image: editImage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", productsStoreId] });
      setEditingProduct(null);
      setEditImage(null);
      setEditPreview(null);
    },
  });

  const importProductsMutation = useMutation({
    mutationFn: () => {
      if (!importFile) {
        throw new Error("Файл не выбран");
      }
      return importProducts(auth.user, auth.password, importFile);
    },
    onSuccess: () => {
      setImportFile(null);
    },
  });

  const quickStatusMutation = useMutation({
    mutationFn: (payload: { id: string; status: string }) =>
      updateOrderStatusAdmin(auth.user, auth.password, payload.id, payload.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-orders"] });
    },
  });

  const featuredQuery = useQuery<FeaturedItem[]>({
    queryKey: ["featured", featuredBlock, auth.user],
    queryFn: () => fetchFeatured(auth.user, auth.password, featuredBlock),
    enabled: canAuth,
  });

  const featuredSearchQuery = useQuery({
    queryKey: ["product-search", featuredSearch],
    queryFn: () => searchProductsByName(featuredSearch),
    enabled: featuredSearch.trim().length >= 2,
    staleTime: 10_000,
  });

  const addFeaturedMutation = useMutation({
    mutationFn: () => {
      const parsedPosition = Number.parseInt(featuredPosition, 10);
      return addFeatured(auth.user, auth.password, {
        product_id: featuredProductId.trim(),
        block_type: featuredBlock,
        position: Number.isNaN(parsedPosition) || parsedPosition < 0 ? 0 : parsedPosition,
      });
    },
    onSuccess: () => {
      setFeaturedProductId("");
      setFeaturedProductName("");
      setFeaturedPosition("0");
      queryClient.invalidateQueries({ queryKey: ["featured", featuredBlock, auth.user] });
    },
  });

  const deleteFeaturedMutation = useMutation({
    mutationFn: (id: string) => deleteFeatured(auth.user, auth.password, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["featured", featuredBlock, auth.user] }),
  });

  const revenue = useMemo(() => {
    const value = statsQuery.data?.today_revenue ?? 0;
    return `${value.toFixed(0)}₽`;
  }, [statsQuery.data]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Laman Admin</h1>
            <p className="text-sm text-slate-500">Управление магазинами и товарами</p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs text-slate-500">Admin user</label>
              <input
                className="mt-1 w-32 rounded-md border border-slate-200 px-2 py-1 text-sm"
                value={auth.user}
                onChange={(e) => setAuth((prev) => ({ ...prev, user: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Password</label>
              <input
                type="password"
                className="mt-1 w-32 rounded-md border border-slate-200 px-2 py-1 text-sm"
                value={auth.password}
                onChange={(e) => setAuth((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={() => {
                localStorage.setItem("admin_user", auth.user);
                localStorage.setItem("admin_password", auth.password);
                queryClient.invalidateQueries({ queryKey: ["stats"] });
              }}
            >
              Сохранить
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6">
        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Зарегистрированные"
            value={statsQuery.data?.total_registered_users ?? "—"}
          />
          <StatCard title="Гостевые" value={statsQuery.data?.total_guests ?? "—"} />
          <StatCard title="Активные заказы" value={statsQuery.data?.active_orders_count ?? "—"} />
          <StatCard title="Выручка сегодня" value={revenue} />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Добавить магазин</h2>
            <div className="mt-4 grid gap-3">
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Название"
                value={storeForm.name}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Адрес"
                value={storeForm.address}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, address: e.target.value }))}
              />
              <select
                className="rounded-md border border-slate-200 px-3 py-2"
                value={storeForm.category_type}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, category_type: e.target.value }))}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <textarea
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Описание"
                value={storeForm.description}
                onChange={(e) => setStoreForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-white"
                disabled={createStoreMutation.isPending || !canAuth}
                onClick={() => createStoreMutation.mutate()}
              >
                Добавить магазин
              </button>
              {createStoreMutation.isError && (
                <p className="text-sm text-red-500">Ошибка: не удалось создать магазин</p>
              )}
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-600">Удалить магазин</h3>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-200 px-3 py-2"
                  placeholder="ID магазина"
                  value={deleteStoreId}
                  onChange={(e) => setDeleteStoreId(e.target.value)}
                />
                <button
                  className="rounded-md bg-rose-600 px-3 py-2 text-white"
                  disabled={!deleteStoreId || !canAuth || deleteStoreMutation.isPending}
                  onClick={() => {
                    if (window.confirm("Удалить магазин?")) {
                      deleteStoreMutation.mutate();
                    }
                  }}
                >
                  Удалить
                </button>
              </div>
              {deleteStoreMutation.isError && (
                <p className="mt-2 text-sm text-red-500">Ошибка: магазин не удален</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Добавить товар</h2>
            <div className="mt-4 grid gap-3">
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Название"
                value={productForm.name}
                onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Цена"
                  value={productForm.price}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Вес (кг)"
                  value={productForm.weight}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, weight: e.target.value }))}
                />
              </div>
              <div
                className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500 transition hover:border-slate-400"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    setProductImage(file);
                    setProductPreview(URL.createObjectURL(file));
                  }
                }}
                onClick={() => document.getElementById("product-image-input")?.click()}
              >
                <input
                  id="product-image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setProductImage(file);
                      setProductPreview(URL.createObjectURL(file));
                    }
                  }}
                />
                {productPreview ? (
                  <img
                    src={productPreview}
                    alt="Preview"
                    className="h-28 w-28 rounded-md object-cover"
                  />
                ) : (
                  <>
                    <span className="font-medium text-slate-600">
                      Перетащите изображение сюда
                    </span>
                    <span className="text-xs">или нажмите для выбора файла</span>
                  </>
                )}
              </div>
              <select
                className="rounded-md border border-slate-200 px-3 py-2"
                value={productForm.store_id}
                onChange={(e) => setProductForm((prev) => ({ ...prev, store_id: e.target.value }))}
              >
                <option value="">Выбери магазин</option>
                {storesQuery.data?.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-200 px-3 py-2"
                value={productForm.category_id}
                onChange={(e) => setProductForm((prev) => ({ ...prev, category_id: e.target.value }))}
              >
                <option value="">Выбери категорию товара</option>
                {categoriesQuery.data?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Подкатегория (опц.)"
                value={productForm.subcategory_id}
                onChange={(e) => setProductForm((prev) => ({ ...prev, subcategory_id: e.target.value }))}
              />
              <textarea
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Описание"
                value={productForm.description}
                onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={productForm.is_available}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, is_available: e.target.checked }))
                  }
                />
                Доступен к продаже
              </label>
              <button
                className="rounded-md bg-indigo-600 px-4 py-2 text-white"
                disabled={createProductMutation.isPending || !canAuth}
                onClick={() => createProductMutation.mutate()}
              >
                Добавить товар
              </button>
              {createProductMutation.isError && (
                <p className="text-sm text-red-500">Ошибка: не удалось создать товар</p>
              )}
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-600">Импорт из Excel/CSV</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
                <button
                  className="rounded-md bg-slate-200 px-3 py-2 text-sm text-slate-800 disabled:opacity-50"
                  onClick={() => importProductsMutation.mutate()}
                  disabled={!importFile}
                >
                  Импортировать
                </button>
              </div>
              {importProductsMutation.isError && (
                <p className="mt-2 text-sm text-red-500">
                  {(importProductsMutation.error as Error).message}
                </p>
              )}
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-600">Удалить товар</h3>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-md border border-slate-200 px-3 py-2"
                  placeholder="ID товара"
                  value={deleteProductId}
                  onChange={(e) => setDeleteProductId(e.target.value)}
                />
                <button
                  className="rounded-md bg-rose-600 px-3 py-2 text-white"
                  disabled={!deleteProductId || !canAuth || deleteProductMutation.isPending}
                  onClick={() => {
                    if (window.confirm("Удалить товар?")) {
                      deleteProductMutation.mutate();
                    }
                  }}
                >
                  Удалить
                </button>
              </div>
              {deleteProductMutation.isError && (
                <p className="mt-2 text-sm text-red-500">Ошибка: товар не удален</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Товары магазина ── */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Товары магазина</h2>
          <div className="flex gap-3 mb-4">
            <select
              className="flex-1 rounded-md border border-slate-200 px-3 py-2"
              value={productsStoreId}
              onChange={(e) => setProductsStoreId(e.target.value)}
            >
              <option value="">Выбери магазин</option>
              {storesQuery.data?.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          {productsQuery.isLoading && <p className="text-slate-400 text-sm">Загрузка...</p>}

          {productsQuery.data && productsQuery.data.length === 0 && (
            <p className="text-slate-400 text-sm">Товаров нет</p>
          )}

          {productsQuery.data && productsQuery.data.length > 0 && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-3">Фото</th>
                    <th className="py-2 pr-3">Название</th>
                    <th className="py-2 pr-3">Цена</th>
                    <th className="py-2 pr-3">Доступен</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {productsQuery.data.map((product: any) => (
                    <tr key={product.id} className="border-t border-slate-50">
                      <td className="py-2 pr-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 text-xs">
                            нет
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium">{product.name}</td>
                      <td className="py-2 pr-3">{product.price} ₽</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${product.is_available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {product.is_available ? "Да" : "Нет"}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          className="rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-medium"
                          onClick={() => {
                            setEditingProduct({
                              id: product.id,
                              name: product.name,
                              price: product.price,
                              description: product.description ?? "",
                              is_available: product.is_available,
                              image_url: product.image_url ?? null,
                            });
                            setEditImage(null);
                            setEditPreview(null);
                          }}
                        >
                          Редактировать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Модалка редактирования ── */}
        {editingProduct && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setEditingProduct(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Редактировать товар</h3>

              <div className="grid gap-3">
                <input
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Название"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct((p) => p && ({ ...p, name: e.target.value }))}
                />
                <input
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Цена"
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct((p) => p && ({ ...p, price: Number(e.target.value) }))}
                />
                <textarea
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Описание"
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct((p) => p && ({ ...p, description: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_available}
                    onChange={(e) => setEditingProduct((p) => p && ({ ...p, is_available: e.target.checked }))}
                  />
                  Доступен к продаже
                </label>

                {/* Фото */}
                <div
                  className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-center text-sm text-slate-500 hover:border-slate-400"
                  onClick={() => document.getElementById("edit-image-input")?.click()}
                >
                  <input
                    id="edit-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setEditImage(file);
                        setEditPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                  {editPreview || editingProduct.image_url ? (
                    <img
                      src={editPreview ?? editingProduct.image_url!}
                      alt="preview"
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs">Нажми чтобы загрузить фото</span>
                  )}
                  {(editPreview || editingProduct.image_url) && (
                    <span className="mt-1 text-xs text-slate-400">Нажми чтобы сменить</span>
                  )}
                </div>
              </div>

              {updateProductMutation.isError && (
                <p className="mt-2 text-sm text-red-500">Ошибка сохранения</p>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
                  disabled={updateProductMutation.isPending}
                  onClick={() => updateProductMutation.mutate()}
                >
                  {updateProductMutation.isPending ? "Сохранение..." : "Сохранить"}
                </button>
                <button
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm"
                  onClick={() => { setEditingProduct(null); setEditImage(null); setEditPreview(null); }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Витрина на главной</h2>

          <div className="grid gap-3 md:grid-cols-3 mb-4">
            {(Object.keys(FEATURED_BLOCK_LABELS) as FeaturedBlockType[]).map((block) => (
              <button
                key={block}
                type="button"
                onClick={() => setFeaturedBlock(block)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  featuredBlock === block
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {FEATURED_BLOCK_LABELS[block]}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Добавить товар в «{FEATURED_BLOCK_LABELS[featuredBlock]}»
            </h3>

            <div className="grid gap-3 md:grid-cols-[1fr,140px,auto] items-end">
              <div className="relative">
                {featuredProductId ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-md">
                    <span className="text-sm font-medium text-indigo-800">{featuredProductName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFeaturedProductId("");
                        setFeaturedProductName("");
                        setFeaturedSearch("");
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-700"
                    >
                      Сменить
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={featuredSearch}
                      onChange={(e) => {
                        setFeaturedSearch(e.target.value);
                        setShowFeaturedResults(true);
                      }}
                      onFocus={() => setShowFeaturedResults(true)}
                      placeholder="Введите название товара..."
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    />
                    {showFeaturedResults && featuredSearch.trim().length >= 2 && (
                      <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-md shadow max-h-56 overflow-y-auto">
                        {featuredSearchQuery.isLoading && (
                          <p className="px-3 py-2 text-sm text-slate-400">Поиск...</p>
                        )}
                        {!featuredSearchQuery.isLoading && (featuredSearchQuery.data ?? []).length === 0 && (
                          <p className="px-3 py-2 text-sm text-slate-400">Ничего не найдено</p>
                        )}
                        {(featuredSearchQuery.data ?? []).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFeaturedProductId(p.id);
                              setFeaturedProductName(p.name);
                              setFeaturedSearch("");
                              setShowFeaturedResults(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <span className="font-medium text-slate-800 text-sm">{p.name}</span>
                            <span className="ml-2 text-slate-400 text-xs">{p.price.toLocaleString("ru-RU")} ₽</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <input
                type="number"
                min="0"
                value={featuredPosition}
                onChange={(e) => setFeaturedPosition(e.target.value)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Позиция"
              />

              <button
                type="button"
                disabled={!featuredProductId.trim() || addFeaturedMutation.isPending}
                onClick={() => addFeaturedMutation.mutate()}
                className="rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-sm"
              >
                {addFeaturedMutation.isPending ? "Добавляем..." : "Добавить"}
              </button>
            </div>

            {addFeaturedMutation.isError && (
              <p className="mt-2 text-sm text-red-500">
                {(addFeaturedMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
                  ?? "Ошибка добавления в витрину"}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
              Сейчас в «{FEATURED_BLOCK_LABELS[featuredBlock]}»
            </div>
            {featuredQuery.isLoading ? (
              <p className="px-4 py-4 text-sm text-slate-400">Загрузка...</p>
            ) : !featuredQuery.data || featuredQuery.data.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">Блок пуст</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2">ID товара</th>
                    <th className="px-4 py-2">Позиция</th>
                    <th className="px-4 py-2">Добавлен</th>
                    <th className="px-4 py-2 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {featuredQuery.data.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono text-xs text-slate-600" title={item.product_id}>
                        {item.product_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2">{item.position}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {new Date(item.created_at).toLocaleString("ru-RU")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteFeaturedMutation.mutate(item.id)}
                          disabled={deleteFeaturedMutation.isPending}
                          className="text-red-600 hover:text-red-700 text-xs"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Изменить статус заказа</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="ID заказа"
              value={orderStatusForm.order_id}
              onChange={(e) => setOrderStatusForm((prev) => ({ ...prev, order_id: e.target.value }))}
            />
            <select
              className="rounded-md border border-slate-200 px-3 py-2"
              value={orderStatusForm.status}
              onChange={(e) => setOrderStatusForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="NEW">NEW</option>
              <option value="NEEDS_CONFIRMATION">NEEDS_CONFIRMATION</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <button
              className="rounded-md bg-slate-900 px-4 py-2 text-white"
              disabled={updateOrderMutation.isPending || !canAuth}
              onClick={() => updateOrderMutation.mutate()}
            >
              Обновить
            </button>
          </div>
          {updateOrderMutation.isError && (
            <p className="mt-3 text-sm text-red-500">Ошибка: статус не обновлен</p>
          )}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Активные заказы</h2>
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2">ID</th>
                  <th className="py-2">Клиент</th>
                  <th className="py-2">Телефон</th>
                  <th className="py-2">Сумма</th>
                  <th className="py-2">Статус</th>
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {activeOrdersQuery.data?.map((order) => (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="py-2">{order.id.slice(0, 8)}</td>
                    <td className="py-2">{order.guest_name ?? "—"}</td>
                    <td className="py-2">{order.guest_phone ?? "—"}</td>
                    <td className="py-2">{order.final_total}₽</td>
                    <td className="py-2">{order.status}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-slate-200 px-2 py-1"
                          onClick={() =>
                            quickStatusMutation.mutate({ id: order.id, status: "CONFIRMED" })
                          }
                        >
                          Принят
                        </button>
                        <button
                          className="rounded-md border border-slate-200 px-2 py-1"
                          onClick={() =>
                            quickStatusMutation.mutate({ id: order.id, status: "IN_PROGRESS" })
                          }
                        >
                          Готовится
                        </button>
                        <button
                          className="rounded-md border border-slate-200 px-2 py-1"
                          onClick={() =>
                            quickStatusMutation.mutate({ id: order.id, status: "IN_PROGRESS" })
                          }
                        >
                          В пути
                        </button>
                        <button
                          className="rounded-md border border-slate-200 px-2 py-1"
                          onClick={() =>
                            quickStatusMutation.mutate({ id: order.id, status: "DELIVERED" })
                          }
                        >
                          Доставлен
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {activeOrdersQuery.isLoading && (
                  <tr>
                    <td className="py-3 text-slate-400" colSpan={6}>
                      Загрузка...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};
