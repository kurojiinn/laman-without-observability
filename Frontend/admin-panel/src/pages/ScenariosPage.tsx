import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFeatured,
  createScenario,
  deleteScenario,
  deleteFeatured,
  fetchFeatured,
  fetchFeaturedProducts,
  searchProductsByName,
  updateScenario,
} from "../api/admin";
import { PageHeader, Card, Btn, ProductSearchInput } from "../components/Layout";
import type { Scenario } from "../types";
import { SECTION_KEY_LABELS } from "../types";

interface Props { user: string; password: string; }

const SECTION_KEYS = Object.keys(SECTION_KEY_LABELS);

const EMPTY: Omit<Scenario, "id" | "created_at" | "updated_at"> = {
  label: "",
  subtitle: "",
  section_key: "new_items",
  image_url: "",
  emoji: "",
  position: 0,
  is_active: true,
};

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

export function ScenariosPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductName, setSelectedProductName] = useState("");

  const scenariosQ = useQuery({
    queryKey: ["scenarios", user],
    queryFn: () => fetchScenarios(user, password),
  });

  const featuredItemsQ = useQuery({
    queryKey: ["featured-items", form.section_key, user],
    queryFn: () => fetchFeatured(user, password, form.section_key),
    enabled: !!editId,
  });

  const featuredProductsQ = useQuery({
    queryKey: ["featured-products", form.section_key],
    queryFn: () => fetchFeaturedProducts(form.section_key),
    enabled: !!editId,
  });

  const searchQ = useQuery({
    queryKey: ["product-search", search],
    queryFn: () => searchProductsByName(search),
    enabled: search.trim().length >= 2,
    staleTime: 10_000,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      editId
        ? updateScenario(user, password, editId, form)
        : createScenario(user, password, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenarios"] });
      setForm({ ...EMPTY });
      setEditId(null);
      setShowForm(false);
      setSearch("");
      setSelectedProductId("");
      setSelectedProductName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteScenario(user, password, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios"] }),
  });

  const addProductMut = useMutation({
    mutationFn: (productId: string) =>
      addFeatured(user, password, {
        product_id: productId,
        block_type: form.section_key,
        position: (featuredProductsQ.data?.length ?? 0),
      }),
    onSuccess: () => {
      setSelectedProductId("");
      setSelectedProductName("");
      setSearch("");
      qc.invalidateQueries({ queryKey: ["featured-items", form.section_key] });
      qc.invalidateQueries({ queryKey: ["featured-products", form.section_key] });
    },
  });

  const removeProductMut = useMutation({
    mutationFn: (featuredId: string) => deleteFeatured(user, password, featuredId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["featured-items", form.section_key] });
      qc.invalidateQueries({ queryKey: ["featured-products", form.section_key] });
    },
  });

  function startEdit(sc: Scenario) {
    setEditId(sc.id);
    setForm({
      label: sc.label,
      subtitle: sc.subtitle,
      section_key: sc.section_key,
      image_url: sc.image_url,
      emoji: sc.emoji,
      position: sc.position,
      is_active: sc.is_active,
    });
    setSearch("");
    setSelectedProductId("");
    setSelectedProductName("");
    setShowForm(true);
  }

  function cancelForm() {
    setForm({ ...EMPTY });
    setEditId(null);
    setShowForm(false);
    setSearch("");
    setSelectedProductId("");
    setSelectedProductName("");
  }

  const itemIdByProductId = new Map(
    (featuredItemsQ.data ?? []).map((fi) => [fi.product_id, fi.id])
  );

  const scenarioProducts = featuredProductsQ.data ?? [];
  const scenarios = scenariosQ.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Быстрые сценарии"
        subtitle="Карточки сценариев на главном экране — Перекус, Для кино, На ужин и др."
        action={
          !showForm && (
            <Btn onClick={() => setShowForm(true)}>+ Новый сценарий</Btn>
          )
        }
      />

      {/* Form */}
      {showForm && (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">
            {editId ? "Редактировать сценарий" : "Новый сценарий"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Название *</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Перекус"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Подпись</label>
              <input
                type="text"
                value={form.subtitle}
                onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                placeholder="Быстро и вкусно"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Блок витрины *</label>
              <select
                value={form.section_key}
                onChange={(e) => {
                  setForm((p) => ({ ...p, section_key: e.target.value }));
                  setSelectedProductId("");
                  setSelectedProductName("");
                  setSearch("");
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bg-white"
              >
                {SECTION_KEYS.map((k) => (
                  <option key={k} value={k}>{SECTION_KEY_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Эмодзи</label>
              <input
                type="text"
                value={form.emoji}
                onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))}
                placeholder="⚡"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Путь к картинке
                <span className="ml-1 text-gray-400 font-normal">(например: /scenarios/еда.jpeg)</span>
              </label>
              <input
                type="text"
                value={form.image_url}
                onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                placeholder="/scenarios/еда.jpeg"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
              {form.image_url && (
                <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden border border-gray-100">
                  <img src={resolveImg(form.image_url)!} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Позиция (порядок)</label>
              <input
                type="number"
                value={form.position}
                onChange={(e) => setForm((p) => ({ ...p, position: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700">Активный (показывать на главной)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Btn
              onClick={() => saveMut.mutate()}
              disabled={!form.label.trim() || saveMut.isPending}
            >
              {saveMut.isPending ? "Сохранение..." : editId ? "Сохранить" : "Создать"}
            </Btn>
            <button
              onClick={cancelForm}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Отмена
            </button>
            {saveMut.isError && (
              <p className="text-xs text-red-500 self-center">
                {(saveMut.error as any)?.response?.data?.error ?? "Ошибка сохранения"}
              </p>
            )}
          </div>

          {/* Product management — only when editing */}
          {editId && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h4 className="text-sm font-bold text-gray-800 mb-3">
                Товары блока «{SECTION_KEY_LABELS[form.section_key] ?? form.section_key}»
              </h4>

              {/* Add product */}
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <ProductSearchInput
                    value={selectedProductId}
                    name={selectedProductName}
                    searchResults={searchQ.data ?? []}
                    isSearching={searchQ.isFetching}
                    onSelect={(id, name) => {
                      setSelectedProductId(id);
                      setSelectedProductName(name);
                      if (!id) setSearch(name);
                    }}
                    onClear={() => {
                      setSelectedProductId("");
                      setSelectedProductName("");
                      setSearch("");
                    }}
                  />
                </div>
                <button
                  onClick={() => selectedProductId && addProductMut.mutate(selectedProductId)}
                  disabled={!selectedProductId || addProductMut.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  {addProductMut.isPending ? "..." : "+ Добавить"}
                </button>
              </div>

              {/* Current products in block */}
              {featuredProductsQ.isLoading ? (
                <p className="text-xs text-gray-400">Загрузка товаров...</p>
              ) : scenarioProducts.length === 0 ? (
                <p className="text-xs text-gray-400">Товаров в этом блоке пока нет</p>
              ) : (
                <div className="space-y-2">
                  {scenarioProducts.map((product) => {
                    const featuredId = itemIdByProductId.get(product.id);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          {product.image_url ? (
                            <img
                              src={resolveImg(product.image_url)!}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">—</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-gray-400">{product.price} ₽</p>
                        </div>
                        {featuredId && (
                          <button
                            onClick={() => removeProductMut.mutate(featuredId)}
                            disabled={removeProductMut.isPending}
                            className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Убрать из блока"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Scenario list */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Сценарии</h2>
          <span className="text-xs text-gray-400">{scenarios.length} шт.</span>
        </div>

        {scenariosQ.isLoading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : scenarios.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">⚡</p>
            <p className="text-sm">Нет сценариев — добавьте первый</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {scenarios.map((sc) => (
              <div key={sc.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center text-xl">
                  {sc.image_url
                    ? <img src={resolveImg(sc.image_url)!} alt={sc.label} className="w-full h-full object-cover" />
                    : sc.emoji || "⚡"
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{sc.emoji} {sc.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${sc.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {sc.is_active ? "активен" : "скрыт"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{sc.subtitle}</p>
                  <p className="text-xs text-indigo-500 mt-0.5">{SECTION_KEY_LABELS[sc.section_key] ?? sc.section_key} · позиция {sc.position}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(sc)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => { if (confirm(`Удалить сценарий «${sc.label}»?`)) deleteMut.mutate(sc.id); }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                    title="Удалить"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// re-export to avoid duplicate import
import { fetchScenarios } from "../api/admin";
