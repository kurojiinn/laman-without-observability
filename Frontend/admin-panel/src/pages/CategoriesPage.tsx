import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStoreCategory,
  deleteStoreCategory,
  fetchStoreCategoryMeta,
  fetchStores,
  updateStore,
  updateStoreCategoryImage,
  updateStoreCategoryMeta,
  type StoreCategoryMeta,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import type { Store } from "../types";

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return `${window.location.origin}${pathname}`;
  } catch {
    return `${window.location.origin}${url}`;
  }
}

interface Props { user: string; password: string; }

export function CategoriesPage({ user, password }: Props) {
  const qc = useQueryClient();

  // ── Выбранная категория (детальная панель) ──
  const [selectedMeta, setSelectedMeta] = useState<StoreCategoryMeta | null>(null);

  // ── Редактирование категории ──
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // ── Смена категории конкретного магазина ──
  const [changeCatStore, setChangeCatStore] = useState<Store | null>(null);
  const [newCatType, setNewCatType] = useState<string>("");

  // ── Создание категории ──
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);

  // ── Удаление категории ──
  const [deleteOpen, setDeleteOpen] = useState(false);

  const storeMeta = useQuery({ queryKey: ["store-category-meta"], queryFn: fetchStoreCategoryMeta });
  const storesQ = useQuery({ queryKey: ["stores"], queryFn: fetchStores });

  const categories = storeMeta.data ?? [];
  const storesByType = (type: string) => (storesQ.data ?? []).filter((s) => s.category_type === type);
  const categoryOptions = categories.map((m) => ({ value: m.category_type, label: m.name ?? m.category_type }));

  function openCategory(meta: StoreCategoryMeta) {
    setSelectedMeta(meta);
    setEditName(meta.name ?? "");
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

  const createMut = useMutation({
    mutationFn: () => createStoreCategory(user, password, newName.trim(), newImageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-category-meta"] });
      setCreateOpen(false); setNewName(""); setNewImageFile(null); setNewImagePreview(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteStoreCategory(user, password, selectedMeta!.category_type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-category-meta"] });
      qc.invalidateQueries({ queryKey: ["stores"] });
      setDeleteOpen(false);
      setSelectedMeta(null);
    },
  });

  // ── Layout: список или детали ──

  if (selectedMeta) {
    const stores = storesByType(selectedMeta.category_type);
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
            {editName || selectedMeta.category_type}
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
                  disabled={saveMetaMut.isPending || !editName.trim() || (!editImageFile && editName.trim() === (selectedMeta.name ?? "") && editDescription.trim() === (selectedMeta.description ?? ""))}
                  className="w-full justify-center"
                >
                  {saveMetaMut.isPending ? "Сохранение..." : "Сохранить"}
                </Btn>
                {saveMetaMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
                {saveMetaMut.isSuccess && <p className="text-xs text-green-600">Сохранено</p>}
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-gray-900 mb-1 text-sm">Удалить категорию</h2>
              <p className="text-xs text-gray-400 mb-3">
                Магазины этой категории не удалятся — они просто останутся без категории.
              </p>
              <Btn variant="danger" onClick={() => setDeleteOpen(true)} className="w-full justify-center">
                Удалить категорию
              </Btn>
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
                    onClick={() => { setChangeCatStore(store); setNewCatType(store.category_type ?? ""); }}
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
              <Btn onClick={() => changeCatMut.mutate()} disabled={changeCatMut.isPending || !newCatType} className="flex-1">
                {changeCatMut.isPending ? "Сохранение..." : "Сохранить"}
              </Btn>
            </>
          }
        >
          <Select
            label="Категория магазина"
            value={newCatType}
            onChange={(v) => setNewCatType(v)}
            options={categoryOptions}
          />
          {changeCatMut.isError && <p className="text-xs text-red-500">Ошибка обновления</p>}
        </Modal>

        {/* Модалка: удалить категорию */}
        <Modal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title="Удалить категорию?"
          footer={
            <>
              <Btn variant="secondary" onClick={() => setDeleteOpen(false)} className="flex-1">Отмена</Btn>
              <Btn variant="danger" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="flex-1">
                {deleteMut.isPending ? "Удаление..." : "Удалить"}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            Удалить категорию <strong>«{selectedMeta.name ?? selectedMeta.category_type}»</strong>?
          </p>
          {stores.length > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ В этой категории <strong>{stores.length}</strong>{" "}
              {stores.length === 1 ? "магазин" : "магазинов"}. Они останутся, но окажутся без категории.
            </p>
          )}
          {deleteMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка удаления</p>}
        </Modal>
      </div>
    );
  }

  // ── Главный экран: список категорий ──
  return (
    <div className="p-6">
      <PageHeader
        title="Категории магазинов"
        subtitle="Нажмите на категорию, чтобы изменить название, фото и список магазинов"
        action={
          <Btn onClick={() => setCreateOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Добавить
          </Btn>
        }
      />

      {storeMeta.isLoading ? (
        <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
      ) : categories.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400">
          <p className="text-3xl mb-2">🗂️</p>
          <p className="text-sm">Категорий пока нет. Добавьте первую.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((meta) => {
            const count = storesByType(meta.category_type).length;
            const name = meta.name ?? meta.category_type;
            const imageUrl = meta.image_url ?? null;
            return (
              <button
                key={meta.category_type}
                onClick={() => openCategory(meta)}
                className="relative flex flex-col justify-between p-4 rounded-2xl border border-gray-100 bg-white hover:shadow-md hover:border-indigo-100 active:scale-[0.98] transition-all text-left overflow-hidden min-h-[100px]"
              >
                {imageUrl && (
                  <>
                    <img src={resolveImg(imageUrl)!} alt={name} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50" />
                  </>
                )}
                <div className="relative">
                  <p className={`font-bold text-sm ${imageUrl ? "text-white" : "text-gray-900"}`}>{name}</p>
                  {meta.description && (
                    <p className={`text-xs mt-0.5 line-clamp-2 ${imageUrl ? "text-white/70" : "text-gray-400"}`}>{meta.description}</p>
                  )}
                </div>
                <div className="relative flex items-center justify-between mt-3">
                  <span className={`text-xs ${imageUrl ? "text-white/70" : "text-gray-400"}`}>
                    {count} {count === 1 ? "магазин" : count >= 2 && count <= 4 ? "магазина" : "магазинов"}
                  </span>
                  <svg className={`w-4 h-4 ${imageUrl ? "text-white/70" : "text-gray-400"}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Модалка: создать категорию */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setNewName(""); setNewImageFile(null); setNewImagePreview(null); }}
        title="Новая категория магазинов"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => createMut.mutate()} disabled={createMut.isPending || !newName.trim()} className="flex-1">
              {createMut.isPending ? "Создание..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={newName} onChange={setNewName} placeholder="Например: Цветы" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Фото (фон плитки)</label>
          <ImageUploadZone preview={newImagePreview} onFile={(f, url) => { setNewImageFile(f); setNewImagePreview(url); }} inputId="new-store-cat-image" />
        </div>
        {createMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>
    </div>
  );
}
