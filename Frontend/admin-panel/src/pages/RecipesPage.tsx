import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRecipeProduct, createRecipe, deleteRecipe, fetchRecipe,
  fetchRecipes, removeRecipeProduct, searchProductsByName, updateRecipe,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, ProductSearchInput } from "../components/Layout";
import type { Recipe, RecipeWithProducts } from "../types";

interface Props { user: string; password: string; }

const apiBase = (() => {
  const v = (import.meta as any).env?.VITE_API_BASE_URL;
  return v || (typeof window !== "undefined" ? `http://${window.location.hostname}:8080` : "");
})();
function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${apiBase}${url}`;
}

export function RecipesPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", description: "", image_url: "", position: "0" });
  const [editForm, setEditForm] = useState({ name: "", description: "", image_url: "", position: "0" });

  // Product search for adding ingredients
  const [ingSearch, setIngSearch] = useState("");
  const [ingId, setIngId] = useState("");
  const [ingName, setIngName] = useState("");
  const [ingQty, setIngQty] = useState("1");

  const recipesQ = useQuery({
    queryKey: ["recipes", user],
    queryFn: () => fetchRecipes(user, password),
  });

  const recipeDetailQ = useQuery<RecipeWithProducts>({
    queryKey: ["recipe-detail", openRecipeId, user],
    queryFn: () => fetchRecipe(user, password, openRecipeId!),
    enabled: !!openRecipeId,
  });

  const ingSearchQ = useQuery({
    queryKey: ["product-search", ingSearch],
    queryFn: () => searchProductsByName(ingSearch),
    enabled: ingSearch.trim().length >= 2,
    staleTime: 10_000,
  });

  const createMut = useMutation({
    mutationFn: () => createRecipe(user, password, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      position: parseInt(form.position) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setCreateOpen(false);
      setForm({ name: "", description: "", image_url: "", position: "0" });
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
      setIngId(""); setIngName(""); setIngSearch(""); setIngQty("1");
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

  const recipe = recipeDetailQ.data;

  return (
    <div className="p-6">
      <PageHeader
        title="Рецепты"
        subtitle="Блюда с набором ингредиентов — клиент может добавить всё в корзину одним нажатием"
        action={
          <Btn onClick={() => setCreateOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Новый рецепт
          </Btn>
        }
      />

      <div className={`grid gap-5 ${openRecipeId ? "lg:grid-cols-[1fr,400px]" : ""}`}>
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
              {recipesQ.data.map((r) => (
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
                    <p className="text-xs text-gray-300 mt-0.5">Позиция {r.position}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(r)}
                    >
                      Изменить
                    </Btn>
                    <Btn
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Удалить рецепт «${r.name}»?`)) deleteMut.mutate(r.id);
                      }}
                    >
                      Удалить
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recipe ingredients panel */}
        {openRecipeId && (
          <Card className="h-fit">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">
                {recipe?.name ?? "Ингредиенты"}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {recipe?.products.length ?? 0} товаров
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
                      className="text-gray-300 hover:text-red-500 transition-colors"
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
              <ProductSearchInput
                value={ingId}
                name={ingName}
                onSelect={(id, name) => { setIngId(id); setIngName(name); if (!id) setIngSearch(name); }}
                onClear={() => { setIngId(""); setIngName(""); setIngSearch(""); }}
                searchResults={ingSearchQ.data ?? []}
                isSearching={ingSearchQ.isLoading}
              />
              <div className="flex gap-2">
                <Input
                  label=""
                  type="number"
                  value={ingQty}
                  onChange={setIngQty}
                  placeholder="Кол-во"
                />
                <Btn
                  onClick={() => addIngMut.mutate()}
                  disabled={!ingId || addIngMut.isPending}
                  className="mt-0 self-end"
                >
                  {addIngMut.isPending ? "..." : "Добавить"}
                </Btn>
              </div>
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
            <Btn onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name.trim()} className="flex-1">
              {createMut.isPending ? "Создание..." : "Создать"}
            </Btn>
          </>
        }
      >
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
