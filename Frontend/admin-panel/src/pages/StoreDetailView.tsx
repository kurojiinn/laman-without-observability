import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct,
  createStoreSubcategory,
  deleteProduct,
  deleteStoreSubcategory,
  fetchProducts,
  fetchStoreCategoryMeta,
  fetchStoreSubcategories,
  updateProduct,
  updateStoreSubcategory,
  uploadStoreImage,
  updateStore,
} from "../api/admin";
import type { StoreSubcategory } from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import { ProductOptionsEditor } from "../components/ProductOptionsEditor";
import type { Product, Store, StoreCategoryType } from "../types";

interface Props {
  user: string;
  password: string;
  store: Store;
  onBack: () => void;
}

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

  // ── Категории магазина (двухуровневые) ──
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  // Родитель для создаваемой подкатегории (категория верхнего уровня).
  const [createSubParent, setCreateSubParent] = useState<StoreSubcategory | null>(null);
  const [newSubName, setNewSubName] = useState("");
  // Переименование — работает и для категории, и для подкатегории.
  const [renameTarget, setRenameTarget] = useState<StoreSubcategory | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteSubTarget, setDeleteSubTarget] = useState<StoreSubcategory | null>(null);

  // ── Редактирование магазина ──
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: store.name,
    address: store.address,
    city: store.city ?? "Ойсхар",
    description: store.description ?? "",
    category_type: store.category_type ?? "",
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(resolveImg(store.image_url));

  // ── Создание товара ── l1_id — категория, l2_id — подкатегория (если у l1 есть дети) ──
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    price: "",
    weight: "",
    description: "",
    l1_id: "",
    l2_id: "",
    is_available: true,
  });
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);

  // ── Редактирование товара ──
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editProductData, setEditProductData] = useState({
    name: "", price: 0, description: "", is_available: true, l1_id: "", l2_id: "",
  });
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
  const categoriesQ = useQuery({
    queryKey: ["store-category-meta"],
    queryFn: fetchStoreCategoryMeta,
  });
  const categoryOptions = (categoriesQ.data ?? []).map((m) => ({
    value: m.category_type,
    label: m.name ?? m.category_type,
  }));
  const storeCategoryName =
    (categoriesQ.data ?? []).find((m) => m.category_type === store.category_type)?.name ??
    store.category_type ??
    "Без категории";

  // ── Дерево категорий магазина из плоского списка ──
  const subs = subsQ.data ?? [];
  const subsById = new Map(subs.map((s) => [s.id, s]));
  const topCats = subs.filter((s) => !s.parent_id);
  const childrenOf = (parentId: string) => subs.filter((s) => s.parent_id === parentId);
  const hasChildren = (id: string) => subs.some((s) => s.parent_id === id);

  // Опции для зависимых выпадающих списков формы товара.
  const l1Options = topCats.map((s) => ({ value: s.id, label: s.name }));
  const createL2Options = childrenOf(productForm.l1_id).map((s) => ({ value: s.id, label: s.name }));
  const editL2Options = childrenOf(editProductData.l1_id).map((s) => ({ value: s.id, label: s.name }));

  // Итоговый subcategory_id товара: подкатегория, если у категории есть дети, иначе сама категория.
  function leafSubId(l1Id: string, l2Id: string): string {
    if (!l1Id) return "";
    return hasChildren(l1Id) ? l2Id : l1Id;
  }

  const createCatMut = useMutation({
    mutationFn: () => createStoreSubcategory(user, password, store.id, newCatName.trim(), null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      setCreateCatOpen(false);
      setNewCatName("");
    },
  });

  const createSubMut = useMutation({
    mutationFn: () => createStoreSubcategory(user, password, store.id, newSubName.trim(), createSubParent!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      setCreateSubParent(null);
      setNewSubName("");
    },
  });

  const renameSubMut = useMutation({
    mutationFn: () => updateStoreSubcategory(user, password, store.id, renameTarget!.id, renameValue.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
      qc.invalidateQueries({ queryKey: ["store-products", store.id] });
      setRenameTarget(null);
      setRenameValue("");
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
      // category_id не передаём — товар привязан к категории магазина (subcategory_id)
      subcategory_id: leafSubId(productForm.l1_id, productForm.l2_id) || undefined,
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
      setProductForm({ name: "", price: "", weight: "", description: "", l1_id: "", l2_id: "", is_available: true });
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
      // Всегда шлём subcategory_id: "" — явный сброс привязки.
      subcategory_id: leafSubId(editProductData.l1_id, editProductData.l2_id),
      image: editProductImage,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-products", store.id] });
      qc.invalidateQueries({ queryKey: ["store-subcategories", store.id] });
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
    // Восстанавливаем выбор категории/подкатегории из subcategory_id товара.
    let l1 = "";
    let l2 = "";
    if (p.subcategory_id) {
      const sub = subsById.get(p.subcategory_id);
      if (sub?.parent_id) {
        l1 = sub.parent_id;
        l2 = sub.id;
      } else if (sub) {
        l1 = sub.id;
      }
    }
    setEditProductData({
      name: p.name, price: p.price, description: p.description ?? "", is_available: p.is_available,
      l1_id: l1, l2_id: l2,
    });
    setEditProductImage(null);
    setEditProductPreview(resolveImg(p.image_url));
  }

  // Группировка товаров по подкатегориям (лист = подкатегория или бездетная категория).
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
  // Порядок секций: для каждой категории — её подкатегории, либо сама категория если детей нет.
  const productSections: { id: string; label: string }[] = [];
  for (const cat of topCats) {
    const kids = childrenOf(cat.id);
    if (kids.length > 0) {
      for (const kid of kids) productSections.push({ id: kid.id, label: `${cat.name} › ${kid.name}` });
      // Товары, привязанные к самой категории (без подкатегории).
      if (productsBySub.has(cat.id)) productSections.push({ id: cat.id, label: `${cat.name} · без подкатегории` });
    } else {
      productSections.push({ id: cat.id, label: cat.name });
    }
  }

  const createL2Required = !!productForm.l1_id && hasChildren(productForm.l1_id);
  const editL2Required = !!editProductData.l1_id && hasChildren(editProductData.l1_id);
  const deleteSubChildCount = deleteSubTarget ? childrenOf(deleteSubTarget.id).length : 0;

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
                {storeCategoryName}
              </span>
              {store.description && <span className="text-xs text-gray-400 truncate">{store.description}</span>}
            </div>
          </div>
          <Btn variant="secondary" onClick={() => setEditOpen(true)}>Редактировать</Btn>
        </div>
      </Card>

      {/* Категории магазина (двухуровневые) */}
      <PageHeader
        title="Категории внутри магазина"
        subtitle="Категория и её подкатегории. Например: «От горла» → «Сиропы», «Таблетки»"
        action={<Btn onClick={() => setCreateCatOpen(true)}>+ Добавить категорию</Btn>}
      />
      <Card className="mb-6">
        {subsQ.isLoading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : topCats.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400">
            <p className="text-sm">Категорий пока нет. Добавьте первую — например «От горла».</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {topCats.map((cat) => {
              const kids = childrenOf(cat.id);
              return (
                <div key={cat.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-400">
                        Товаров: {cat.products_count}
                        {kids.length > 0 && ` · подкатегорий: ${kids.length}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Btn variant="ghost" size="sm" onClick={() => { setCreateSubParent(cat); setNewSubName(""); }}>
                        + Подкатегория
                      </Btn>
                      <Btn variant="secondary" size="sm" onClick={() => { setRenameTarget(cat); setRenameValue(cat.name); }}>
                        Изменить
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => setDeleteSubTarget(cat)}>Удалить</Btn>
                    </div>
                  </div>
                  {kids.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-gray-100 space-y-1">
                      {kids.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300">└</span>
                            <span className="text-sm text-gray-700">{sub.name}</span>
                            <span className="text-xs text-gray-400">· {sub.products_count} тов.</span>
                          </div>
                          <div className="flex gap-1.5">
                            <Btn variant="secondary" size="sm" onClick={() => { setRenameTarget(sub); setRenameValue(sub.name); }}>
                              Изменить
                            </Btn>
                            <Btn variant="danger" size="sm" onClick={() => setDeleteSubTarget(sub)}>Удалить</Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
            {productSections.map((section) =>
              productsBySub.has(section.id) ? (
                <div key={section.id}>
                  <div className="px-5 py-2 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {section.label}
                  </div>
                  {productsBySub.get(section.id)!.map((p) => (
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
        open={createCatOpen}
        onClose={() => { setCreateCatOpen(false); setNewCatName(""); }}
        title="Новая категория"
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setCreateCatOpen(false); setNewCatName(""); }} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => createCatMut.mutate()}
              disabled={createCatMut.isPending || !newCatName.trim()}
              className="flex-1"
            >
              {createCatMut.isPending ? "Сохранение..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input
          label="Название *"
          value={newCatName}
          onChange={setNewCatName}
          placeholder="Например: От горла, Напитки, Пиццы"
        />
        {createCatMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка создания</p>}
      </Modal>

      {/* ── Модалка: создать подкатегорию ── */}
      <Modal
        open={!!createSubParent}
        onClose={() => { setCreateSubParent(null); setNewSubName(""); }}
        title={`Подкатегория в «${createSubParent?.name ?? ""}»`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setCreateSubParent(null); setNewSubName(""); }} className="flex-1">Отмена</Btn>
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
          placeholder="Например: Сиропы, Таблетки"
        />
        {createSubMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка создания</p>}
      </Modal>

      {/* ── Модалка: переименовать категорию/подкатегорию ── */}
      <Modal
        open={!!renameTarget}
        onClose={() => { setRenameTarget(null); setRenameValue(""); }}
        title={renameTarget?.parent_id ? "Переименовать подкатегорию" : "Переименовать категорию"}
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setRenameTarget(null); setRenameValue(""); }} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => renameSubMut.mutate()}
              disabled={renameSubMut.isPending || !renameValue.trim()}
              className="flex-1"
            >
              {renameSubMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={renameValue} onChange={setRenameValue} />
        {renameSubMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка сохранения</p>}
      </Modal>

      {/* ── Модалка: удалить категорию/подкатегорию ── */}
      <Modal
        open={!!deleteSubTarget}
        onClose={() => setDeleteSubTarget(null)}
        title={deleteSubTarget?.parent_id ? "Удалить подкатегорию?" : "Удалить категорию?"}
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
          Удалить {deleteSubTarget?.parent_id ? "подкатегорию" : "категорию"}{" "}
          <strong>«{deleteSubTarget?.name}»</strong>?
        </p>
        {deleteSubChildCount > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ Внутри <strong>{deleteSubChildCount}</strong>{" "}
            {deleteSubChildCount === 1 ? "подкатегория" : "подкатегорий"} — они тоже будут удалены.
          </p>
        )}
        {deleteSubTarget && deleteSubTarget.products_count > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ Здесь <strong>{deleteSubTarget.products_count}</strong>{" "}
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
        <Select label="Категория" value={editForm.category_type} onChange={(v) => setEditForm((p) => ({ ...p, category_type: v as StoreCategoryType }))} options={categoryOptions} />
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
              disabled={
                createProductMut.isPending || !productForm.name.trim() || !productForm.price ||
                (createL2Required && !productForm.l2_id)
              }
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
              value={productForm.l1_id}
              onChange={(v) => setProductForm((p) => ({ ...p, l1_id: v, l2_id: "" }))}
              options={l1Options}
              placeholder={l1Options.length ? "— без категории —" : "Сначала создайте категории выше"}
            />
          </div>
          {productForm.l1_id && createL2Options.length > 0 && (
            <div className="col-span-2">
              <Select
                label="Подкатегория *"
                value={productForm.l2_id}
                onChange={(v) => setProductForm((p) => ({ ...p, l2_id: v }))}
                options={createL2Options}
                placeholder="— выберите —"
              />
            </div>
          )}
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
            <Btn
              onClick={() => updateProductMut.mutate()}
              disabled={updateProductMut.isPending || (editL2Required && !editProductData.l2_id)}
              className="flex-1"
            >
              {updateProductMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название" value={editProductData.name} onChange={(v) => setEditProductData((p) => ({ ...p, name: v }))} />
        <Input label="Цена (₽)" type="number" value={editProductData.price} onChange={(v) => setEditProductData((p) => ({ ...p, price: Number(v) }))} />
        <Select
          label="Категория"
          value={editProductData.l1_id}
          onChange={(v) => setEditProductData((p) => ({ ...p, l1_id: v, l2_id: "" }))}
          options={l1Options}
          placeholder="— без категории —"
        />
        {editProductData.l1_id && editL2Options.length > 0 && (
          <Select
            label="Подкатегория *"
            value={editProductData.l2_id}
            onChange={(v) => setEditProductData((p) => ({ ...p, l2_id: v }))}
            options={editL2Options}
            placeholder="— выберите —"
          />
        )}
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

        {/* Опции товара — становятся доступны только после сохранения базовой карточки. */}
        {editProduct && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-2">Опции товара</p>
            <ProductOptionsEditor
              user={user}
              password={password}
              productId={editProduct.id}
              basePrice={editProductData.price}
            />
          </div>
        )}
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
