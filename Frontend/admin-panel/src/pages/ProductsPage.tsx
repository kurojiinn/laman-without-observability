import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProduct, deleteProduct, fetchCategories,
  fetchStores, importProducts, searchStoreProducts, updateProduct,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import type { Product } from "../types";

interface Props { user: string; password: string; }

const apiBase = window.location.origin;

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return `${window.location.origin}${pathname}`;
  } catch {
    return `${window.location.origin}${url}`;
  }
}

export function ProductsPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "", price: "", weight: "", description: "",
    category_id: "", subcategory_id: "", is_available: true,
  });
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formPreview, setFormPreview] = useState<string | null>(null);

  const [editData, setEditData] = useState({ name: "", price: 0, description: "", is_available: true });
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);

  const storesQ = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const productsQ = useQuery({
    queryKey: ["products-search", storeId, searchQuery],
    queryFn: () => searchStoreProducts(storeId, searchQuery),
    enabled: !!storeId && searchQuery.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: () => createProduct(user, password, {
      name: form.name.trim(),
      price: Number(form.price),
      weight: form.weight ? Number(form.weight) : undefined,
      store_id: storeId,
      category_id: form.category_id,
      subcategory_id: form.subcategory_id || undefined,
      description: form.description.trim() || undefined,
      is_available: form.is_available,
      image: formImage,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products-search", storeId] });
      setCreateOpen(false);
      setForm({ name: "", price: "", weight: "", description: "", category_id: "", subcategory_id: "", is_available: true });
      setFormImage(null); setFormPreview(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: () => updateProduct(user, password, editProduct!.id, {
      name: editData.name.trim(),
      price: editData.price,
      description: editData.description.trim() || undefined,
      is_available: editData.is_available,
      image: editImage,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products-search", storeId] });
      setEditProduct(null); setEditImage(null); setEditPreview(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProduct(user, password, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products-search", storeId] }),
  });

  const importMut = useMutation({
    mutationFn: () => importProducts(user, password, importFile!),
    onSuccess: () => { setImportFile(null); qc.invalidateQueries({ queryKey: ["products-search", storeId] }); },
  });

  const storeOptions = (storesQ.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const catOptions = (catsQ.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  function openEdit(p: Product) {
    setEditProduct(p);
    setEditData({ name: p.name, price: p.price, description: p.description ?? "", is_available: p.is_available });
    setEditImage(null);
    setEditPreview(resolveImg(p.image_url));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  const products = productsQ.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Товары"
        subtitle="Управление товарами магазинов"
        action={
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
              {importFile ? importFile.name.slice(0, 12) + "…" : "Импорт CSV"}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
            </label>
            {importFile && (
              <Btn variant="secondary" size="sm" onClick={() => importMut.mutate()} disabled={importMut.isPending}>
                {importMut.isPending ? "Импорт..." : "Загрузить"}
              </Btn>
            )}
            <Btn onClick={() => setCreateOpen(true)} disabled={!storeId}>
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
              Добавить товар
            </Btn>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-4 mb-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Select
              label="Магазин"
              value={storeId}
              onChange={(v) => { setStoreId(v); setSearchQuery(""); setSearchInput(""); }}
              options={storeOptions}
              placeholder="— выберите магазин —"
            />
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 items-end">
            <div className="flex-1">
              <Input
                label="Поиск по названию"
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Введите название..."
              />
            </div>
            <Btn type="submit" disabled={!storeId || searchInput.trim().length < 2}>
              Найти
            </Btn>
          </form>
        </div>
      </Card>

      {/* Results */}
      <Card>
        {!storeId ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">☝️</p>
            <p className="text-sm">Выберите магазин</p>
          </div>
        ) : !searchQuery ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm">Введите название и нажмите «Найти»</p>
          </div>
        ) : productsQ.isLoading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Поиск...</div>
        ) : products.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm">Ничего не найдено по запросу «{searchQuery}»</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["", "Название", "Цена", "Вес", "Доступен", ""].map((h, i) => (
                    <th key={i} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        {p.image_url
                          ? <img src={resolveImg(p.image_url)!} alt={p.name} className="w-full h-full object-cover" />
                          : <span className="text-gray-300 text-lg">🛍️</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900 max-w-[220px]">
                      <p className="truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-900">{p.price.toLocaleString("ru-RU")} ₽</td>
                    <td className="px-4 py-2 text-gray-500">{p.weight ? `${p.weight} кг` : "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.is_available ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.is_available ? "Да" : "Нет"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Btn size="sm" variant="ghost" onClick={() => openEdit(p)}>Изменить</Btn>
                        <Btn size="sm" variant="danger" onClick={() => { if (confirm("Удалить товар?")) deleteMut.mutate(p.id); }}>
                          Удалить
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create product modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый товар"
        size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.name.trim() || !form.price || !form.category_id}
              className="flex-1"
            >
              {createMut.isPending ? "Сохранение..." : "Создать"}
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Название *" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Название товара" />
          </div>
          <Input label="Цена (₽) *" type="number" value={form.price} onChange={(v) => setForm((p) => ({ ...p, price: v }))} placeholder="0" />
          <Input label="Вес (кг)" type="number" value={form.weight} onChange={(v) => setForm((p) => ({ ...p, weight: v }))} placeholder="0.5" />
          <div className="col-span-2">
            <Select label="Категория *" value={form.category_id} onChange={(v) => setForm((p) => ({ ...p, category_id: v }))} options={catOptions} placeholder="— выберите —" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none" style={{ fontSize: 16 }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Фото</label>
            <ImageUploadZone preview={formPreview} onFile={(f, u) => { setFormImage(f); setFormPreview(u); }} inputId="create-product-img" />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="avail" checked={form.is_available} onChange={(e) => setForm((p) => ({ ...p, is_available: e.target.checked }))} className="rounded" />
            <label htmlFor="avail" className="text-sm text-gray-600">Доступен к продаже</label>
          </div>
        </div>
        {createMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>

      {/* Edit product modal */}
      <Modal
        open={!!editProduct}
        onClose={() => { setEditProduct(null); setEditImage(null); setEditPreview(null); }}
        title="Редактировать товар"
        footer={
          <>
            <Btn variant="secondary" onClick={() => { setEditProduct(null); setEditImage(null); setEditPreview(null); }} className="flex-1">Отмена</Btn>
            <Btn onClick={() => updateMut.mutate()} disabled={updateMut.isPending} className="flex-1">
              {updateMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название" value={editData.name} onChange={(v) => setEditData((p) => ({ ...p, name: v }))} />
        <Input label="Цена (₽)" type="number" value={editData.price} onChange={(v) => setEditData((p) => ({ ...p, price: Number(v) }))} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea value={editData.description} onChange={(e) => setEditData((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none" style={{ fontSize: 16 }} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Фото</label>
          <ImageUploadZone preview={editPreview} onFile={(f, u) => { setEditImage(f); setEditPreview(u); }} inputId="edit-product-img" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="edit-avail" checked={editData.is_available} onChange={(e) => setEditData((p) => ({ ...p, is_available: e.target.checked }))} className="rounded" />
          <label htmlFor="edit-avail" className="text-sm text-gray-600">Доступен к продаже</label>
        </div>
        {updateMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
      </Modal>
    </div>
  );
}
