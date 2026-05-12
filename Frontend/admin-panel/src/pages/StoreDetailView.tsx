import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  createStoreSubcategory,
  deleteProduct,
  deleteStoreSubcategory,
  fetchProducts,
  fetchStoreSubcategories,
  updateProduct,
  uploadStoreImage,
  updateStore,
} from "../api/admin";
import type { StoreSubcategory } from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import type { Product, Store, StoreCategoryType } from "../types";
import { STORE_CATEGORY_LABELS } from "../types";

interface Props {
  user: string;
  password: string;
  store: Store;
  onBack: () => void;
}

const CATEGORY_OPTIONS = Object.entries(STORE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
const CITY_OPTIONS = [
  { value: "Грозный", label: "Грозный" },
  { value: "Ойсхар", label: "Ойсхар" },
];

const apiBase = (() => {
  const v = (import.meta as any).env?.VITE_API_BASE_URL;
  return v || (typeof window !== "undefined" ? `http://${window.location.hostname}:8080` : "");
})();

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try { new URL(url); return url; } catch { return `${apiBase}${url}`; }
}

export function StoreDetailView({ user, password, store, onBack }: Props) {
  const qc = useQueryClient();

  // ── Подкатегории ──
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [deleteSubTarget, setDeleteSubTarget] = useState<StoreSubcategory | null>(null);

  // ── Редактирование магазина ──
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: store.name,
    address: store.address,
    city: store.city ?? "Ойсхар",
    description: store.description ?? "",
    category_type: store.category_type,
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(resolveImg(store.image_url));

  // ── Создание товара ──
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    weight: "",
    description: "",
    subcategory_id: "",
    is_available: true,
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  // ── Редактирование товара ──
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editProductData, setEditProductData] = useState({ name: "", price: 0, description: "", is_available: true });
  const [editProductImage, setEditProductImage] = useState<File | null>(null);
  const [editProductPreview, setEditProductPreview] = useState<string | null>(null);

  // ── Удаление товара ──
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);

  const subsQ = useQuery({
    queryKey: ["store-subcategories", store.id],
    queryFn: () => fetchStoreSubcategories(user, password, store.id),
  });
  const productsQ = useQuery({
    queryKey: ["store-products", store.id],
    queryFn: () => fetchProducts(user, password, store.id),
  });

  const subOptions = (subsQ.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  // Подкатегории, в которые сгруппированы товары — для отображения секциями.
  const subsById = new Map((subsQ.data ?? []).map((s) => [s.id, s]));

  const createSubMut = useMutation({
    mutationFn: () => createStoreSubcategory(user, password, store.id, newSubName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      setCreateSubOpen(false);
      setNewSubName("");
    },
  });

  const deleteSubMut = useMutation({
    mutationFn: (subId: string) => deleteStoreSubcategory(user, password, store.id, subId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      qc.invalidateQueries({ queryKey: ["store-products", store.id] });
      setDeleteSubTarget(null);
    },
  });

  const editStoreMut = useMutation({
    mutationFn: async () => {
      await updateStore(user, password, store.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        city: editForm.city,
        description: editForm.description.trim(),
        category_type: editForm.category_type,
      });
      if (editImageFile) {
        await uploadStoreImage(user, password, store.id, editImageFile);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      qc.invalidateQueries({ queryKey: ["stores"] });
      setEditOpen(false);
    },
  });

  const createProductMut = useMutation({
    mutationFn: () => createProduct(user, password, {
      store_id: store.id,
      // category_id не передаём — товар привязан к store-local subcategory
      subcategory_id: productForm.subcategory_id || undefined,
      name: productForm.name.trim(),
      price: Number(productForm.price),
      weight: productForm.weight ? Number(productForm.weight) : undefined,
      description: productForm.description.trim() || undefined,
      is_available: productForm.is_available,
      image: productImage,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-products", store.id] });
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      setCreateProductOpen(false);
      setProductForm({ name: "", price: "", weight: "", description: "", subcategory_id: "", is_available: true });
      setProductImage(null);
      setProductPreview(null);
    },
  });

  const updateProductMut = useMutation({
    mutationFn: () => updateProduct(user, password, editProduct!.id, {
      name: editProductData.name.trim(),
      price: editProductData.price,
      description: editProductData.description.trim() || undefined,
      is_available: editProductData.is_available,
      image: editProductImage,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-products", store.id] });
      setEditProduct(null);
      setEditProductImage(null);
      setEditProductPreview(null);
    },
  });

  const deleteProductMut = useMutation({
    mutationFn: (id: string) => deleteProduct(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-products", store.id] });
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      setDeleteProductTarget(null);
    },
  });

  function openEditProduct(p: Product) {
    setEditProduct(p);
    setEditProductData({ name: p.name, price: p.price, description: p.description ?? "", is_available: p.is_available });
    setEditProductImage(null);
    setEditProductPreview(resolveImg(p.image_url));
  }

  // Группировка товаров по подкатегориям
  const products = productsQ.data ?? [];
  const productsBySub = new Map<string, Product[]>();
  const productsWithoutSub: Product[] = [];
  for (const p of products) {
    if (p.subcategory_id && subsById.has(p.subcategory_id)) {
      const arr = productsBySub.get(p.subcategory_id) ?? [];
      arr.push(p);
      productsBySub.set(p.subcategory_id, arr);
    } else {
      productsWithoutSub.push(p);
    }
  }

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Все магазины
      </button>

      {/* Шапка магазина */}
      <Card className="p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
            {store.image_url ? (
              <img src={resolveImg(store.image_url)!} alt={store.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl font-bold">
                {store.name[0]}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
              {store.is_active === false && (
                <span className="text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                  В архиве
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{store.address} · {store.city ?? "—"}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {STORE_CATEGORY_LABELS[store.category_type] ?? store.category_type}
              </span>
              {store.description && <span className="text-xs text-gray-400 truncate">{store.description}</span>}
            </div>
          </div>
          <Btn variant="secondary" onClick={() => setEditOpen(true)}>Редактировать</Btn>
        </div>
      </Card>

      {/* Подкатегории магазина */}
      <PageHeader
        title="Категории внутри магазина"
        subtitle="Например: напитки, мясо, пиццы, коктейли"
        action={<Btn onClick={() => setCreateSubOpen(true)}>+ Добавить категорию</Btn>}
      />
      <Card className="mb-6">
        {subsQ.isLoading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : (subsQ.data ?? []).length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400">
            <p className="text-sm">Категорий пока нет. Добавьте первую — например «Напитки».</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {subsQ.data!.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{sub.name}</p>
                  <p className="text-xs text-gray-400">Товаров: {sub.products_count}</p>
                </div>
                <Btn variant="danger" size="sm" onClick={() => setDeleteSubTarget(sub)}>Удалить</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Товары */}
      <PageHeader
        title="Товары"
        subtitle={`Всего: ${products.length}`}
        action={
          <Btn onClick={() => setCreateProductOpen(true)}>+ Добавить товар</Btn>
        }
      />
      <Card>
        {productsQ.isLoading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : products.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm">Товаров пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(subsQ.data ?? []).map((sub) =>
              productsBySub.has(sub.id) ? (
                <div key={sub.id}>
                  <div className="px-5 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {sub.name}
                  </div>
                  {productsBySub.get(sub.id)!.map((p) => (
                    <ProductRow key={p.id} product={p} onEdit={() => openEditProduct(p)} onDelete={() => setDeleteProductTarget(p)} />
                  ))}
                </div>
              ) : null
            )}
            {productsWithoutSub.length > 0 && (
              <div>
                <div className="px-5 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Без категории
                </div>
                {productsWithoutSub.map((p) => (
                  <ProductRow key={p.id} product={p} onEdit={() => openEditProduct(p)} onDelete={() => setDeleteProductTarget(p)} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Модалка: создать категорию ── */}
      <Modal
        open={createSubOpen}
        onClose={() => { setCreateSubOpen(false); setNewSubName(""); }}
        title="Новая категория"
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setCreateSubOpen(false); setNewSubName(""); }} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => createSubMut.mutate()}
              disabled={createSubMut.isPending || !newSubName.trim()}
              className="flex-1"
            >
              {createSubMut.isPending ? "Сохранение..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input
          label="Название *"
          value={newSubName}
          onChange={setNewSubName}
          placeholder="Например: Пиццы, Напитки, Десерты"
        />
        {createSubMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка создания</p>}
      </Modal>

      {/* ── Модалка: удалить категорию ── */}
      <Modal
        open={!!deleteSubTarget}
        onClose={() => setDeleteSubTarget(null)}
        title="Удалить категорию?"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteSubTarget(null)} className="flex-1">Отмена</Btn>
            <Btn
              variant="danger"
              onClick={() => deleteSubTarget && deleteSubMut.mutate(deleteSubTarget.id)}
              disabled={deleteSubMut.isPending}
              className="flex-1"
            >
              {deleteSubMut.isPending ? "Удаление..." : "Удалить"}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Удалить категорию <strong>«{deleteSubTarget?.name}»</strong>?
        </p>
        {deleteSubTarget && deleteSubTarget.products_count > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ В этой категории <strong>{deleteSubTarget.products_count}</strong>{" "}
            {deleteSubTarget.products_count === 1 ? "товар" : "товаров"}. Они останутся в магазине,
            но окажутся «Без категории».
          </p>
        )}
        {deleteSubMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка удаления</p>}
      </Modal>

      {/* ── Модалка: редактировать магазин ── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Изменить: ${store.name}`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => editStoreMut.mutate()}
              disabled={editStoreMut.isPending || !editForm.name.trim()}
              className="flex-1"
            >
              {editStoreMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={editForm.name} onChange={(v) => setEditForm((p) => ({ ...p, name: v }))} />
        <Input label="Адрес" value={editForm.address} onChange={(v) => setEditForm((p) => ({ ...p, address: v }))} />
        <Select label="Город" value={editForm.city} onChange={(v) => setEditForm((p) => ({ ...p, city: v }))} options={CITY_OPTIONS} />
        <Select label="Категория" value={editForm.category_type} onChange={(v) => setEditForm((p) => ({ ...p, category_type: v as StoreCategoryType }))} options={CATEGORY_OPTIONS} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea
            value={editForm.description}
            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
            style={{ fontSize: 16 }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Фото</label>
          <ImageUploadZone
            preview={editImagePreview}
            onFile={(f, url) => { setEditImageFile(f); setEditImagePreview(url); }}
            inputId="store-edit-image"
          />
        </div>
        {editStoreMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
      </Modal>

      {/* ── Модалка: создать товар ── */}
      <Modal
        open={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        title="Новый товар"
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateProductOpen(false)} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => createProductMut.mutate()}
              disabled={createProductMut.isPending || !productForm.name.trim() || !productForm.price}
              className="flex-1"
            >
              {createProductMut.isPending ? "Сохранение..." : "Создать"}
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Название *" value={productForm.name} onChange={(v) => setProductForm((p) => ({ ...p, name: v }))} placeholder="Маргарита" />
          </div>
          <Input label="Цена (₽) *" type="number" value={productForm.price} onChange={(v) => setProductForm((p) => ({ ...p, price: v }))} placeholder="350" />
          <Input label="Вес (кг)" type="number" value={productForm.weight} onChange={(v) => setProductForm((p) => ({ ...p, weight: v }))} placeholder="0.4" />
          <div className="col-span-2">
            <Select
              label="Категория"
              value={productForm.subcategory_id}
              onChange={(v) => setProductForm((p) => ({ ...p, subcategory_id: v }))}
              options={subOptions}
              placeholder={subOptions.length ? "— без категории —" : "Сначала создайте категории выше"}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Фото</label>
            <ImageUploadZone
              preview={productPreview}
              onFile={(f, u) => { setProductImage(f); setProductPreview(u); }}
              inputId="store-detail-product-img"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="store-detail-avail"
              checked={productForm.is_available}
              onChange={(e) => setProductForm((p) => ({ ...p, is_available: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="store-detail-avail" className="text-sm text-gray-600">Доступен к продаже</label>
          </div>
        </div>
        {createProductMut.isError && <p className="text-xs text-red-500">Ошибка создания товара</p>}
      </Modal>

      {/* ── Модалка: редактировать товар ── */}
      <Modal
        open={!!editProduct}
        onClose={() => { setEditProduct(null); setEditProductImage(null); setEditProductPreview(null); }}
        title="Редактировать товар"
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setEditProduct(null); setEditProductImage(null); setEditProductPreview(null); }} className="flex-1">Отмена</Btn>
            <Btn onClick={() => updateProductMut.mutate()} disabled={updateProductMut.isPending} className="flex-1">
              {updateProductMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название" value={editProductData.name} onChange={(v) => setEditProductData((p) => ({ ...p, name: v }))} />
        <Input label="Цена (₽)" type="number" value={editProductData.price} onChange={(v) => setEditProductData((p) => ({ ...p, price: Number(v) }))} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea
            value={editProductData.description}
            onChange={(e) => setEditProductData((p) => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
            style={{ fontSize: 16 }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Фото</label>
          <ImageUploadZone
            preview={editProductPreview}
            onFile={(f, u) => { setEditProductImage(f); setEditProductPreview(u); }}
            inputId="store-detail-edit-img"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="store-detail-edit-avail"
            checked={editProductData.is_available}
            onChange={(e) => setEditProductData((p) => ({ ...p, is_available: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="store-detail-edit-avail" className="text-sm text-gray-600">Доступен к продаже</label>
        </div>
        {updateProductMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
      </Modal>

      {/* ── Модалка: удалить товар ── */}
      <Modal
        open={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        title="Удалить товар?"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteProductTarget(null)} className="flex-1">Отмена</Btn>
            <Btn
              variant="danger"
              onClick={() => deleteProductTarget && deleteProductMut.mutate(deleteProductTarget.id)}
              disabled={deleteProductMut.isPending}
              className="flex-1"
            >
              {deleteProductMut.isPending ? "Удаление..." : "Удалить"}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Удалить <strong>«{deleteProductTarget?.name}»</strong>? Это действие нельзя отменить.
        </p>
        {deleteProductMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка удаления</p>}
      </Modal>
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        {product.image_url ? (
          <img src={resolveImg(product.image_url)!} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">🛍️</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{product.name}</p>
        {product.description && <p className="text-xs text-gray-400 truncate">{product.description}</p>}
      </div>
      <div className="text-sm font-semibold text-gray-900 flex-shrink-0">
        {product.price.toLocaleString("ru-RU")} ₽
      </div>
      {!product.is_available && (
        <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
          Нет в наличии
        </span>
      )}
      <div className="flex gap-1.5 flex-shrink-0">
        <Btn size="sm" variant="ghost" onClick={onEdit}>Изменить</Btn>
        <Btn size="sm" variant="danger" onClick={onDelete}>Удалить</Btn>
      </div>
    </div>
  );
}
