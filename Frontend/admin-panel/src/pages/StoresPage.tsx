import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  archiveStore,
  createStore,
  deleteStore,
  fetchAdminStores,
  restoreStore,
  updateStore,
  uploadStoreImage,
} from "../api/admin";
import type { DeleteStoreConflict } from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import type { Store, StoreCategoryType } from "../types";
import { STORE_CATEGORY_LABELS } from "../types";
import { StoreDetailView } from "./StoreDetailView";

interface Props { user: string; password: string; }

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

export function StoresPage({ user, password }: Props) {
  const qc = useQueryClient();

  // Выбранный магазин для детального просмотра. Если задан — рендерим StoreDetailView.
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // ── Создание ──
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", city: "Ойсхар",
    category_type: "FOOD" as StoreCategoryType, description: "",
  });

  // ── Редактирование ──
  const [editTarget, setEditTarget] = useState<Store | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", address: "", city: "", description: "", category_type: "FOOD" as StoreCategoryType,
  });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  // ── Удаление / Архивация ──
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveSuggestion, setArchiveSuggestion] = useState<DeleteStoreConflict | null>(null);

  const storesQ = useQuery({
    queryKey: ["admin-stores"],
    queryFn: () => fetchAdminStores(user, password),
  });

  function openEdit(store: Store) {
    setEditTarget(store);
    setEditForm({
      name: store.name,
      address: store.address,
      city: store.city ?? "Ойсхар",
      description: store.description ?? "",
      category_type: store.category_type,
    });
    setEditImageFile(null);
    setEditImagePreview(resolveImg(store.image_url));
  }

  const createMut = useMutation({
    mutationFn: () => createStore(user, password, {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city,
      category_type: form.category_type,
      description: form.description.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      setCreateOpen(false);
      setForm({ name: "", address: "", city: "Ойсхар", category_type: "FOOD", description: "" });
    },
  });

  const editMut = useMutation({
    mutationFn: async () => {
      await updateStore(user, password, editTarget!.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        city: editForm.city,
        description: editForm.description.trim(),
        category_type: editForm.category_type,
      });
      if (editImageFile) {
        await uploadStoreImage(user, password, editTarget!.id, editImageFile);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      setEditTarget(null);
      setEditImageFile(null);
      setEditImagePreview(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStore(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      setDeleteTarget(null);
      setDeleteError(null);
      setArchiveSuggestion(null);
    },
    onError: (err) => {
      // 409 → бэк говорит «нельзя удалить, есть зависимости»; предлагаем архивацию.
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const body = err.response.data as DeleteStoreConflict;
        if (body?.code === "store_has_dependencies") {
          setArchiveSuggestion(body);
          return;
        }
      }
      setDeleteError("Не удалось удалить магазин");
    },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveStore(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      setDeleteTarget(null);
      setArchiveSuggestion(null);
      setDeleteError(null);
    },
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreStore(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
    },
  });

  // Все хуки объявлены выше. Early return допустим только после них —
  // иначе React падает с ошибкой "Rendered fewer hooks than expected" (#300).
  const selectedStore = selectedStoreId
    ? (storesQ.data ?? []).find((s) => s.id === selectedStoreId) ?? null
    : null;

  if (selectedStore) {
    return (
      <StoreDetailView
        user={user}
        password={password}
        store={selectedStore}
        onBack={() => setSelectedStoreId(null)}
      />
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Магазины"
        subtitle={`Всего: ${storesQ.data?.length ?? "—"}`}
        action={
          <Btn onClick={() => setCreateOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Добавить магазин
          </Btn>
        }
      />

      <Card>
        {storesQ.isLoading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : !storesQ.data?.length ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">🏪</p>
            <p className="text-sm">Магазинов пока нет</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {storesQ.data.map((store) => {
              const archived = store.is_active === false;
              return (
              <div
                key={store.id}
                onClick={() => setSelectedStoreId(store.id)}
                role="button"
                tabIndex={0}
                className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors ${
                  archived ? "bg-gray-50 opacity-60 hover:opacity-100" : "hover:bg-gray-50"
                }`}
              >
                {/* Фото */}
                <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100">
                  {store.image_url ? (
                    <img src={resolveImg(store.image_url)!} alt={store.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg font-bold">
                      {store.name[0]}
                    </div>
                  )}
                </div>

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm truncate">{store.name}</p>
                    {archived && (
                      <span className="text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        В архиве
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{store.address} · {store.city ?? "—"}</p>
                  {store.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{store.description}</p>
                  )}
                </div>

                {/* Категория + рейтинг */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                    {STORE_CATEGORY_LABELS[store.category_type] ?? store.category_type}
                  </span>
                  {store.rating > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {store.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Кнопки */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Btn variant="secondary" size="sm" onClick={() => openEdit(store)}>Изменить</Btn>
                  {archived ? (
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => restoreMut.mutate(store.id)}
                      disabled={restoreMut.isPending}
                    >
                      Восстановить
                    </Btn>
                  ) : (
                    <Btn variant="danger" size="sm" onClick={() => { setDeleteTarget(store); setDeleteError(null); setArchiveSuggestion(null); }}>Удалить</Btn>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Модалка: создать ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый магазин"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !form.name.trim() || !form.address.trim()}
              className="flex-1"
            >
              {createMut.isPending ? "Сохранение..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Название магазина" />
        <Input label="Адрес *" value={form.address} onChange={(v) => setForm((p) => ({ ...p, address: v }))} placeholder="ул. Пушкина, 1" />
        <Select label="Город" value={form.city} onChange={(v) => setForm((p) => ({ ...p, city: v }))} options={CITY_OPTIONS} />
        <Select label="Категория" value={form.category_type} onChange={(v) => setForm((p) => ({ ...p, category_type: v as StoreCategoryType }))} options={CATEGORY_OPTIONS} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Краткое описание магазина"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
            style={{ fontSize: 16 }}
          />
        </div>
        {createMut.isError && <p className="text-xs text-red-500">Ошибка создания магазина</p>}
      </Modal>

      {/* ── Модалка: редактировать ── */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Изменить: ${editTarget?.name ?? ""}`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setEditTarget(null)} className="flex-1">Отмена</Btn>
            <Btn
              onClick={() => editMut.mutate()}
              disabled={editMut.isPending || !editForm.name.trim()}
              className="flex-1"
            >
              {editMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={editForm.name} onChange={(v) => setEditForm((p) => ({ ...p, name: v }))} placeholder="Название магазина" />
        <Input label="Адрес" value={editForm.address} onChange={(v) => setEditForm((p) => ({ ...p, address: v }))} placeholder="ул. Пушкина, 1" />
        <Select label="Город" value={editForm.city} onChange={(v) => setEditForm((p) => ({ ...p, city: v }))} options={CITY_OPTIONS} />
        <Select label="Категория" value={editForm.category_type} onChange={(v) => setEditForm((p) => ({ ...p, category_type: v as StoreCategoryType }))} options={CATEGORY_OPTIONS} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
          <textarea
            value={editForm.description}
            onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Краткое описание"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
            style={{ fontSize: 16 }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Фото</label>
          <ImageUploadZone
            preview={editImagePreview}
            onFile={(f, url) => { setEditImageFile(f); setEditImagePreview(url); }}
            inputId="edit-store-image"
          />
        </div>
        {editMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
      </Modal>

      {/* ── Модалка: удалить / архивировать ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); setArchiveSuggestion(null); }}
        title={archiveSuggestion ? "Магазин нельзя удалить" : "Удалить магазин?"}
        footer={
          archiveSuggestion ? (
            <>
              <Btn
                variant="secondary"
                onClick={() => { setDeleteTarget(null); setArchiveSuggestion(null); }}
                className="flex-1"
              >
                Отмена
              </Btn>
              <Btn
                onClick={() => deleteTarget && archiveMut.mutate(deleteTarget.id)}
                disabled={archiveMut.isPending}
                className="flex-1"
              >
                {archiveMut.isPending ? "Архивация..." : "Архивировать"}
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Отмена</Btn>
              <Btn
                variant="secondary"
                onClick={() => deleteTarget && archiveMut.mutate(deleteTarget.id)}
                disabled={archiveMut.isPending}
                className="flex-1"
              >
                {archiveMut.isPending ? "..." : "Архивировать"}
              </Btn>
              <Btn
                variant="danger"
                onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="flex-1"
              >
                {deleteMut.isPending ? "Удаление..." : "Удалить"}
              </Btn>
            </>
          )
        }
      >
        {archiveSuggestion ? (
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              У магазина <strong>«{deleteTarget?.name}»</strong> есть привязанные данные, поэтому его нельзя физически удалить:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {archiveSuggestion.orders > 0 && <li>Заказов: <strong>{archiveSuggestion.orders}</strong></li>}
              {archiveSuggestion.pickers > 0 && <li>Сборщиков: <strong>{archiveSuggestion.pickers}</strong></li>}
            </ul>
            <p>
              Архивация скроет магазин из клиентского каталога, но сохранит историю заказов и привязки сборщиков.
              Магазин всегда можно восстановить.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Удалить <strong>«{deleteTarget?.name}»</strong>? Все товары магазина будут удалены безвозвратно.
            </p>
            <p className="text-xs text-gray-400">
              Если у магазина есть история заказов или сборщики — система предложит архивацию.
            </p>
          </div>
        )}
        {deleteError && <p className="text-xs text-red-500 mt-2">{deleteError}</p>}
      </Modal>
    </div>
  );
}
