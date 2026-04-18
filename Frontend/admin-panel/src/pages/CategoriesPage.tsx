import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  fetchAdminCategories,
  updateCategoryImage,
  fetchStoreCategoryMeta,
  updateStoreCategoryImage,
  type StoreCategoryMeta,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, ImageUploadZone } from "../components/Layout";
import type { Category } from "../types";

interface Props { user: string; password: string; }

const STORE_TYPE_LABELS: Record<string, string> = {
  FOOD: "Продукты",
  PHARMACY: "Аптека",
  BUILDING: "Стройматериалы",
  HOME: "Химия и быт",
  CLOTHES: "Одежда",
  AUTO: "Авто",
};

export function CategoriesPage({ user, password }: Props) {
  const qc = useQueryClient();

  // ── Состояние для типов магазинов ──
  const [storeTypeTarget, setStoreTypeTarget] = useState<StoreCategoryMeta | null>(null);
  const [storeTypeImageFile, setStoreTypeImageFile] = useState<File | null>(null);
  const [storeTypeImagePreview, setStoreTypeImagePreview] = useState<string | null>(null);

  // ── Состояние для продуктовых категорий ──
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [imageTarget, setImageTarget] = useState<Category | null>(null);
  const [newName, setNewName] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const storeMeta = useQuery({
    queryKey: ["store-category-meta"],
    queryFn: fetchStoreCategoryMeta,
  });

  const catsQ = useQuery({
    queryKey: ["admin-categories", user],
    queryFn: () => fetchAdminCategories(user, password),
  });

  const updateStoreTypeMut = useMutation({
    mutationFn: () => updateStoreCategoryImage(user, password, storeTypeTarget!.category_type, storeTypeImageFile!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-category-meta"] });
      setStoreTypeTarget(null);
      setStoreTypeImageFile(null);
      setStoreTypeImagePreview(null);
    },
  });

  const createMut = useMutation({
    mutationFn: () => createCategory(user, password, newName, newImageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setCreateOpen(false);
      setNewName("");
      setNewImageFile(null);
      setNewImagePreview(null);
    },
  });

  const updateImageMut = useMutation({
    mutationFn: () => updateCategoryImage(user, password, imageTarget!.id, editImageFile!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setImageTarget(null);
      setEditImageFile(null);
      setEditImagePreview(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCategory(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setDeleteTarget(null);
    },
  });

  function openStoreTypeModal(item: StoreCategoryMeta) {
    setStoreTypeTarget(item);
    setStoreTypeImageFile(null);
    setStoreTypeImagePreview(item.image_url ?? null);
  }

  function openImageModal(cat: Category) {
    setImageTarget(cat);
    setEditImageFile(null);
    setEditImagePreview(cat.image_url ?? null);
  }

  return (
    <div className="p-6 space-y-8">
      {/* ── Типы магазинов ── */}
      <div>
        <PageHeader title="Фоны категорий" subtitle="Изображения на плитках главной страницы" />
        <Card>
          {storeMeta.isLoading ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Загрузка...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(storeMeta.data ?? []).map((item) => (
                <div key={item.category_type} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 cursor-pointer relative group"
                    onClick={() => openStoreTypeModal(item)}
                  >
                    {item.image_url ? (
                      <>
                        <img src={item.image_url} alt={item.category_type} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{STORE_TYPE_LABELS[item.category_type] ?? item.category_type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.category_type}</p>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={() => openStoreTypeModal(item)}>
                    Сменить фото
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Категории товаров ── */}
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
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 cursor-pointer relative group"
                    onClick={() => openImageModal(cat)}
                  >
                    {cat.image_url ? (
                      <>
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{cat.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Btn variant="secondary" size="sm" onClick={() => openImageModal(cat)}>Фото</Btn>
                    <Btn variant="danger" size="sm" onClick={() => setDeleteTarget(cat)}>Удалить</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Модалка: смена фото типа магазина ── */}
      <Modal
        open={!!storeTypeTarget}
        onClose={() => { setStoreTypeTarget(null); setStoreTypeImageFile(null); setStoreTypeImagePreview(null); }}
        title={`Фон: ${STORE_TYPE_LABELS[storeTypeTarget?.category_type ?? ""] ?? storeTypeTarget?.category_type ?? ""}`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setStoreTypeTarget(null)} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => updateStoreTypeMut.mutate()}
              disabled={updateStoreTypeMut.isPending || !storeTypeImageFile}
              className="flex-1"
            >
              {updateStoreTypeMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <ImageUploadZone
          preview={storeTypeImagePreview}
          onFile={(f, url) => { setStoreTypeImageFile(f); setStoreTypeImagePreview(url); }}
          inputId="store-type-image"
        />
        {updateStoreTypeMut.isError && <p className="text-xs text-red-500">Ошибка обновления</p>}
      </Modal>

      {/* ── Модалка: создать категорию товаров ── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setNewName(""); setNewImageFile(null); setNewImagePreview(null); }}
        title="Новая категория товаров"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => createMut.mutate()} disabled={createMut.isPending || !newName.trim()} className="flex-1">
              {createMut.isPending ? "Создание..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={newName} onChange={setNewName} placeholder="Напитки" />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Изображение</label>
          <ImageUploadZone
            preview={newImagePreview}
            onFile={(f, url) => { setNewImageFile(f); setNewImagePreview(url); }}
            inputId="new-cat-image"
          />
        </div>
        {createMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>

      {/* ── Модалка: фото продуктовой категории ── */}
      <Modal
        open={!!imageTarget}
        onClose={() => { setImageTarget(null); setEditImageFile(null); setEditImagePreview(null); }}
        title={`Фото: ${imageTarget?.name ?? ""}`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setImageTarget(null)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => updateImageMut.mutate()} disabled={updateImageMut.isPending || !editImageFile} className="flex-1">
              {updateImageMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <ImageUploadZone
          preview={editImagePreview}
          onFile={(f, url) => { setEditImageFile(f); setEditImagePreview(url); }}
          inputId="edit-cat-image"
        />
        {updateImageMut.isError && <p className="text-xs text-red-500">Ошибка обновления</p>}
      </Modal>

      {/* ── Модалка: удалить категорию ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить категорию?"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Отмена</Btn>
            <Btn variant="danger" onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending} className="flex-1">
              {deleteMut.isPending ? "Удаление..." : "Удалить"}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Удалить категорию <strong>«{deleteTarget?.name}»</strong>? Товары удалены не будут.
        </p>
        {deleteMut.isError && <p className="text-xs text-red-500">Ошибка удаления</p>}
      </Modal>
    </div>
  );
}
