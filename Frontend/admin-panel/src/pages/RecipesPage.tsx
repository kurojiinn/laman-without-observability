import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRecipeProduct, createRecipe, deleteRecipe, fetchRecipe,
  fetchRecipes, fetchStores, removeRecipeProduct, searchStoreProducts, updateRecipe,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select } from "../components/Layout";
import type { Recipe, RecipeWithProducts, Store } from "../types";

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

export function RecipesPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);

  const [form, setForm] = useState({ store_id: "", name: "", description: "", image_url: "", position: "0" });
  const [editForm, setEditForm] = useState({ name: "", description: "", image_url: "", position: "0" });

  // Ingredient search state
  const [ingSearch, setIngSearch] = useState("");
  const [ingId, setIngId] = useState("");
  const [ingName, setIngName] = useState("");
  const [ingQty, setIngQty] = useState("1");
  const [showIngResults, setShowIngResults] = useState(false);

  const storesQ = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const stores: Store[] = storesQ.data ?? [];
  const storeOptions = stores.map((s) => ({ value: s.id, label: s.name }));

  const recipesQ = useQuery({
    queryKey: ["recipes", user],
    queryFn: () => fetchRecipes(user, password),
  });

  const recipeDetailQ = useQuery<RecipeWithProducts>({
    queryKey: ["recipe-detail", openRecipeId, user],
    queryFn: () => fetchRecipe(user, password, openRecipeId!),
    enabled: !!openRecipeId,
  });

  const recipe = recipeDetailQ.data;

  // Determine the store for the open recipe
  const recipeStoreId = recipe?.store_id
    ?? recipe?.products[0]?.store_id
    ?? null;
  const recipeStore = recipeStoreId ? stores.find((s) => s.id === recipeStoreId) : null;

  const ingSearchQ = useQuery({
    queryKey: ["store-product-search", recipeStoreId, ingSearch],
    queryFn: () => searchStoreProducts(recipeStoreId!, ingSearch),
    enabled: !!recipeStoreId && ingSearch.trim().length >= 2,
    staleTime: 10_000,
  });

  const createMut = useMutation({
    mutationFn: () => createRecipe(user, password, {
      store_id: form.store_id || undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      position: parseInt(form.position) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setCreateOpen(false);
      setForm({ store_id: "", name: "", description: "", image_url: "", position: "0" });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => updateRecipe(user, password, editRecipe!.id, {
      name: editForm.name.trim(),
      description: editForm.description.trim() || undefined,
      image_url: editForm.image_url.trim() || undefined,
      position: parseInt(editForm.position) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setEditRecipe(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRecipe(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      if (openRecipeId) setOpenRecipeId(null);
    },
  });

  const addIngMut = useMutation({
    mutationFn: () => addRecipeProduct(user, password, openRecipeId!, ingId, parseInt(ingQty) || 1),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipe-detail", openRecipeId] });
      setIngId(""); setIngName(""); setIngSearch(""); setIngQty("1"); setShowIngResults(false);
    },
  });

  const removeIngMut = useMutation({
    mutationFn: (productId: string) => removeRecipeProduct(user, password, openRecipeId!, productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipe-detail", openRecipeId] }),
  });

  function openEdit(r: Recipe) {
    setEditRecipe(r);
    setEditForm({ name: r.name, description: r.description ?? "", image_url: r.image_url ?? "", position: String(r.position) });
  }

  function selectIngredient(id: string, name: string) {
    setIngId(id);
    setIngName(name);
    setIngSearch(name);
    setShowIngResults(false);
  }

  const ingResults = ingSearchQ.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Рецепты"
        subtitle="Блюда с набором ингредиентов — клиент добавляет всё в корзину одним нажатием"
        action={
          <Btn onClick={() => setCreateOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Новый рецепт
          </Btn>
        }
      />

      <div className={`grid gap-5 ${openRecipeId ? "lg:grid-cols-[1fr,420px]" : ""}`}>
        {/* Recipes list */}
        <Card>
          {recipesQ.isLoading ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
          ) : !recipesQ.data?.length ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">👨‍🍳</p>
              <p className="text-sm">Рецептов пока нет</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recipesQ.data.map((r) => {
                const store = r.store_id ? stores.find((s) => s.id === r.store_id) : null;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${openRecipeId === r.id ? "bg-indigo-50" : ""}`}
                    onClick={() => setOpenRecipeId(openRecipeId === r.id ? null : r.id)}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {r.image_url
                        ? <img src={resolveImg(r.image_url)!} alt={r.name} className="w-full h-full object-cover" />
                        : <span className="text-2xl">🍽️</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{r.name}</p>
                      {r.description && <p className="text-xs text-gray-400 truncate mt-0.5">{r.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {store ? `🏪 ${store.name}` : <span className="text-amber-500">Магазин не указан</span>}
                        {" · "} Позиция {r.position}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(r)}>Изменить</Btn>
                      <Btn size="sm" variant="danger" onClick={() => { if (confirm(`Удалить рецепт «${r.name}»?`)) deleteMut.mutate(r.id); }}>
                        Удалить
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recipe ingredients panel */}
        {openRecipeId && (
          <Card className="h-fit">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{recipe?.name ?? "Ингредиенты"}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {recipeStore ? `🏪 ${recipeStore.name}` : <span className="text-amber-500">Магазин не задан</span>}
                {" · "}{recipe?.products.length ?? 0} товаров
              </p>
            </div>

            {/* Existing ingredients */}
            {recipeDetailQ.isLoading ? (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">Загрузка...</div>
            ) : !recipe?.products.length ? (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">Ингредиентов нет</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recipe.products.map((ing) => (
                  <div key={ing.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {ing.image_url
                        ? <img src={resolveImg(ing.image_url)!} alt={ing.name} className="w-full h-full object-cover" />
                        : <span className="text-sm">🛍️</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ing.name}</p>
                      <p className="text-xs text-gray-400">{ing.price.toLocaleString("ru-RU")} ₽ · × {ing.quantity}</p>
                    </div>
                    <button
                      onClick={() => removeIngMut.mutate(ing.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add ingredient */}
            <div className="px-5 py-4 border-t border-gray-100 space-y-3 bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Добавить ингредиент</p>

              {!recipeStoreId ? (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                  Сначала создайте рецепт с указанием магазина, или добавьте хотя бы один ингредиент вручную через поиск ниже — магазин определится автоматически.
                </p>
              ) : null}

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={ingSearch}
                  onChange={(e) => {
                    setIngSearch(e.target.value);
                    setIngId("");
                    setIngName("");
                    setShowIngResults(true);
                  }}
                  onFocus={() => setShowIngResults(true)}
                  placeholder={recipeStoreId ? "Поиск товара в магазине..." : "Поиск недоступен (нет магазина)"}
                  disabled={!recipeStoreId}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-400"
                  style={{ fontSize: 16 }}
                />
                {ingSearch && (
                  <button
                    onClick={() => { setIngSearch(""); setIngId(""); setIngName(""); setShowIngResults(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                )}

                {/* Results dropdown */}
                {showIngResults && ingSearch.trim().length >= 2 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {ingSearchQ.isLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Поиск...</div>
                    ) : ingResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400">Ничего не найдено</div>
                    ) : (
                      ingResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectIngredient(p.id, p.name)}
                          className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                            {p.image_url
                              ? <img src={resolveImg(p.image_url)!} alt={p.name} className="w-full h-full object-cover" />
                              : <span className="text-xs">🛍️</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.price.toLocaleString("ru-RU")} ₽</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected product + quantity + add button */}
              {ingId && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Выбрано: <span className="font-semibold text-gray-800">{ingName}</span></p>
                    <input
                      type="number"
                      min="1"
                      value={ingQty}
                      onChange={(e) => setIngQty(e.target.value)}
                      placeholder="Кол-во"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                      style={{ fontSize: 16 }}
                    />
                  </div>
                  <Btn onClick={() => addIngMut.mutate()} disabled={addIngMut.isPending}>
                    {addIngMut.isPending ? "..." : "Добавить"}
                  </Btn>
                </div>
              )}

              {addIngMut.isError && <p className="text-xs text-red-500">Ошибка добавления</p>}
            </div>
          </Card>
        )}
      </div>

      {/* Create recipe modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый рецепт"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name.trim() || !form.store_id} className="flex-1">
              {createMut.isPending ? "Создание..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Select
          label="Магазин *"
          value={form.store_id}
          onChange={(v) => setForm((p) => ({ ...p, store_id: v }))}
          options={storeOptions}
          placeholder="— выберите магазин —"
        />
        <Input label="Название *" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Например: Борщ" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Краткое описание блюда" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none" style={{ fontSize: 16 }} />
        </div>
        <Input label="URL фото (опц.)" value={form.image_url} onChange={(v) => setForm((p) => ({ ...p, image_url: v }))} placeholder="https://..." />
        <Input label="Позиция" type="number" value={form.position} onChange={(v) => setForm((p) => ({ ...p, position: v }))} placeholder="0" />
        {createMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>

      {/* Edit recipe modal */}
      <Modal
        open={!!editRecipe}
        onClose={() => setEditRecipe(null)}
        title="Редактировать рецепт"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setEditRecipe(null)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !editForm.name.trim()} className="flex-1">
              {updateMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={editForm.name} onChange={(v) => setEditForm((p) => ({ ...p, name: v }))} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none" style={{ fontSize: 16 }} />
        </div>
        <Input label="URL фото" value={editForm.image_url} onChange={(v) => setEditForm((p) => ({ ...p, image_url: v }))} placeholder="https://..." />
        <Input label="Позиция" type="number" value={editForm.position} onChange={(v) => setEditForm((p) => ({ ...p, position: v }))} />
        {updateMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
      </Modal>
    </div>
  );
}
