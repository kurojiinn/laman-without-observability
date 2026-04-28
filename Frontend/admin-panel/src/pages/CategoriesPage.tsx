import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  fetchAdminCategories,
  fetchStoreCategoryMeta,
  fetchStores,
  updateCategory,
  updateCategoryImage,
  updateStore,
  updateStoreCategoryImage,
  updateStoreCategoryMeta,
  type StoreCategoryMeta,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import type { Category, Store, StoreCategoryType } from "../types";
import { STORE_CATEGORY_LABELS } from "../types";

interface Props { user: string; password: string; }

const STORE_TYPE_ORDER: StoreCategoryType[] = ["FOOD", "GROCERY", "PHARMACY", "SWEETS", "HOME", "BUILDING"];
const CATEGORY_OPTIONS = Object.entries(STORE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));

export function CategoriesPage({ user, password }: Props) {
  const qc = useQueryClient();

  // ── Выбранная категория магазинов (детальная панель) ──
  const [selectedMeta, setSelectedMeta] = useState<StoreCategoryMeta | null>(null);

  // ── Редактирование категории магазинов ──
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // ── Смена категории конкретного магазина ──
  const [changeCatStore, setChangeCatStore] = useState<Store | null>(null);
  const [newCatType, setNewCatType] = useState<StoreCategoryType>("FOOD");

  // ── Товарные категории ──
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [editCatTarget, setEditCatTarget] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatImageFile, setEditCatImageFile] = useState<File | null>(null);
  const [editCatImagePreview, setEditCatImagePreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const storeMeta = useQuery({ queryKey: ["store-category-meta"], queryFn: fetchStoreCategoryMeta });
  const storesQ = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const catsQ = useQuery({ queryKey: ["admin-categories", user], queryFn: () => fetchAdminCategories(user, password) });

  const metaByType = Object.fromEntries((storeMeta.data ?? []).map((m) => [m.category_type, m]));
  const storesByType = (type: string) => (storesQ.data ?? []).filter((s) => s.category_type === type);

  function openCategory(type: StoreCategoryType) {
    const meta = metaByType[type] ?? { category_type: type };
    setSelectedMeta(meta);
    setEditName(meta.name ?? STORE_CATEGORY_LABELS[type] ?? "");
    setEditDescription(meta.description ?? "");
    setEditImageFile(null);
    setEditImagePreview(meta.image_url ?? null);
  }

  // ── Mutations ──

  const saveMetaMut = useMutation({
    mutationFn: async () => {
      await updateStoreCategoryMeta(user, password, selectedMeta!.category_type, editName.trim(), editDescription.trim());
      if (editImageFile) {
        await updateStoreCategoryImage(user, password, selectedMeta!.category_type, editImageFile);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-category-meta"] });
      setEditImageFile(null);
      // Обновляем локальный selectedMeta
      setSelectedMeta((prev) => prev ? { ...prev, name: editName.trim(), description: editDescription.trim() } : prev);
    },
  });

  const changeCatMut = useMutation({
    mutationFn: () => updateStore(user, password, changeCatStore!.id, {
      name: changeCatStore!.name,
      address: changeCatStore!.address,
      city: changeCatStore!.city ?? "",
      description: changeCatStore!.description ?? "",
      category_type: newCatType,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      setChangeCatStore(null);
    },
  });

  const editCatMut = useMutation({
    mutationFn: async () => {
      if (editCatName.trim() && editCatName !== editCatTarget!.name)
        await updateCategory(user, password, editCatTarget!.id, editCatName.trim());
      if (editCatImageFile)
        await updateCategoryImage(user, password, editCatTarget!.id, editCatImageFile);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setEditCatTarget(null); setEditCatImageFile(null); setEditCatImagePreview(null);
    },
  });

  const createMut = useMutation({
    mutationFn: () => createCategory(user, password, newName, newImageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setCreateOpen(false); setNewName(""); setNewImageFile(null); setNewImagePreview(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCategory(user, password, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categories"] }); setDeleteTarget(null); },
  });

  // ── Layout: список или детали ──

  if (selectedMeta) {
    const type = selectedMeta.category_type as StoreCategoryType;
    const stores = storesByType(type);
    return (
      <div className="p-6">
        {/* Шапка */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedMeta(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Все категории
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900">
            {editName || STORE_CATEGORY_LABELS[type] || type}
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
          {/* Левая панель: редактирование категории */}
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-bold text-gray-900 mb-4 text-sm">Настройки категории</h2>
              <div className="space-y-3">
                <Input
                  label="Название"
                  value={editName}
                  onChange={setEditName}
                  placeholder="Название категории"
                />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Краткое описание категории"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
                    style={{ fontSize: 16 }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Фото (фон плитки)</label>
                  <ImageUploadZone
                    preview={editImagePreview}
                    onFile={(f, url) => { setEditImageFile(f); setEditImagePreview(url); }}
                    inputId="cat-meta-image"
                  />
                </div>
                <Btn
                  onClick={() => saveMetaMut.mutate()}
                  disabled={saveMetaMut.isPending || (!editImageFile && editName.trim() === (selectedMeta.name ?? "") && editDescription.trim() === (selectedMeta.description ?? ""))}
                  className="w-full justify-center"
                >
                  {saveMetaMut.isPending ? "Сохранение..." : "Сохранить"}
                </Btn>
                {saveMetaMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
                {saveMetaMut.isSuccess && <p className="text-xs text-green-600">Сохранено</p>}
              </div>
            </Card>
          </div>

          {/* Правая панель: список магазинов */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-sm">
                Магазины в категории
                <span className="ml-2 text-gray-400 font-normal">{stores.length}</span>
              </h2>
            </div>
            <Card>
              {storesQ.isLoading ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">Загрузка...</div>
              ) : stores.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400">
                  <p className="text-2xl mb-2">🏪</p>
                  <p className="text-sm">Нет магазинов в этой категории</p>
                </div>
              ) : stores.map((store) => (
                <div key={store.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{store.name}</p>
                    <p className="text-xs text-gray-400 truncate">{store.address}{store.city ? ` · ${store.city}` : ""}</p>
                    {store.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{store.description}</p>
                    )}
                  </div>
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={() => { setChangeCatStore(store); setNewCatType(store.category_type as StoreCategoryType); }}
                  >
                    Изменить категорию
                  </Btn>
                </div>
              ))}
            </Card>
          </div>
        </div>

        {/* Модалка: смена категории магазина */}
        <Modal
          open={!!changeCatStore}
          onClose={() => setChangeCatStore(null)}
          title={`Категория: ${changeCatStore?.name ?? ""}`}
          footer={
            <>
              <Btn variant="secondary" onClick={() => setChangeCatStore(null)} className="flex-1">Отмена</Btn>
              <Btn onClick={() => changeCatMut.mutate()} disabled={changeCatMut.isPending} className="flex-1">
                {changeCatMut.isPending ? "Сохранение..." : "Сохранить"}
              </Btn>
            </>
          }
        >
          <Select
            label="Категория магазина"
            value={newCatType}
            onChange={(v) => setNewCatType(v as StoreCategoryType)}
            options={CATEGORY_OPTIONS}
          />
          {changeCatMut.isError && <p className="text-xs text-red-500">Ошибка обновления</p>}
        </Modal>
      </div>
    );
  }

  // ── Главный экран: список категорий ──
  return (
    <div className="p-6 space-y-8">

      {/* Категории магазинов */}
      <div>
        <PageHeader title="Категории магазинов" subtitle="Нажмите на категорию для редактирования" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STORE_TYPE_ORDER.map((type) => {
            const meta = metaByType[type];
            const count = storesByType(type).length;
            const name = meta?.name ?? STORE_CATEGORY_LABELS[type] ?? type;
            const imageUrl = meta?.image_url ?? null;
            return (
              <button
                key={type}
                onClick={() => openCategory(type)}
                className="relative flex flex-col justify-between p-4 rounded-2xl border border-gray-100 bg-white hover:shadow-md hover:border-indigo-100 active:scale-[0.98] transition-all text-left overflow-hidden min-h-[100px]"
              >
                {imageUrl && (
                  <>
                    <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50" />
                  </>
                )}
                <div className="relative">
                  <p className={`font-bold text-sm ${imageUrl ? "text-white" : "text-gray-900"}`}>{name}</p>
                  {meta?.description && (
                    <p className={`text-xs mt-0.5 line-clamp-2 ${imageUrl ? "text-white/70" : "text-gray-400"}`}>{meta.description}</p>
                  )}
                </div>
                <div className="relative flex items-center justify-between mt-3">
                  <span className={`text-xs ${imageUrl ? "text-white/70" : "text-gray-400"}`}>
                    {count} {count === 1 ? "магазин" : count < 5 ? "магазина" : "магазинов"}
                  </span>
                  <svg className={`w-4 h-4 ${imageUrl ? "text-white/70" : "text-gray-400"}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Категории товаров */}
      <div>
        <PageHeader
          title="Категории товаров"
          subtitle={`Всего: ${catsQ.data?.length ?? "—"}`}
          action={
            <Btn onClick={() => setCreateOpen(true)}>
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Добавить
            </Btn>
          }
        />
        <Card>
          {catsQ.isLoading ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Загрузка...</div>
          ) : !catsQ.data?.length ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="text-2xl mb-2">🗂️</p>
              <p className="text-sm">Категорий пока нет</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {catsQ.data.map((cat) => (
                <div key={cat.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100">
                    {cat.image_url
                      ? <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                          </svg>
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{cat.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Btn variant="secondary" size="sm" onClick={() => { setEditCatTarget(cat); setEditCatName(cat.name); setEditCatImageFile(null); setEditCatImagePreview(cat.image_url ?? null); }}>Изменить</Btn>
                    <Btn variant="danger" size="sm" onClick={() => setDeleteTarget(cat)}>Удалить</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Модалка: редактировать товарную категорию */}
      <Modal open={!!editCatTarget} onClose={() => setEditCatTarget(null)} title={`Изменить: ${editCatTarget?.name ?? ""}`}
        footer={<>
          <Btn variant="secondary" onClick={() => setEditCatTarget(null)} className="flex-1">Отмена</Btn>
          <Btn onClick={() => editCatMut.mutate()} disabled={editCatMut.isPending || (!editCatImageFile && editCatName.trim() === editCatTarget?.name)} className="flex-1">
            {editCatMut.isPending ? "Сохранение..." : "Сохранить"}
          </Btn>
        </>}
      >
        <Input label="Название" value={editCatName} onChange={setEditCatName} placeholder="Название категории" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Изображение</label>
          <ImageUploadZone preview={editCatImagePreview} onFile={(f, url) => { setEditCatImageFile(f); setEditCatImagePreview(url); }} inputId="edit-cat-image" />
        </div>
        {editCatMut.isError && <p className="text-xs text-red-500">Ошибка обновления</p>}
      </Modal>

      {/* Модалка: создать товарную категорию */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setNewName(""); setNewImageFile(null); setNewImagePreview(null); }} title="Новая категория товаров"
        footer={<>
          <Btn variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Отмена</Btn>
          <Btn onClick={() => createMut.mutate()} disabled={createMut.isPending || !newName.trim()} className="flex-1">
            {createMut.isPending ? "Создание..." : "Создать"}
          </Btn>
        </>}
      >
        <Input label="Название *" value={newName} onChange={setNewName} placeholder="Напитки" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Изображение</label>
          <ImageUploadZone preview={newImagePreview} onFile={(f, url) => { setNewImageFile(f); setNewImagePreview(url); }} inputId="new-cat-image" />
        </div>
        {createMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>

      {/* Модалка: удалить товарную категорию */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Удалить категорию?"
        footer={<>
          <Btn variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Отмена</Btn>
          <Btn variant="danger" onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending} className="flex-1">
            {deleteMut.isPending ? "Удаление..." : "Удалить"}
          </Btn>
        </>}
      >
        <p className="text-sm text-gray-600">Удалить категорию <strong>«{deleteTarget?.name}»</strong>? Товары удалены не будут.</p>
        {deleteMut.isError && <p className="text-xs text-red-500">Ошибка удаления</p>}
      </Modal>
    </div>
  );
}
