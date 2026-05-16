import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBanner,
  deleteBanner,
  fetchBanners,
  updateBanner,
  uploadBannerImage,
} from "../api/admin";
import { Btn, Card, ImageUploadZone, PageHeader } from "../components/Layout";
import type { Banner } from "../types";

interface Props { user: string; password: string; }

const EMPTY: Omit<Banner, "id" | "created_at" | "updated_at"> = {
  title: "",
  description: "",
  image_url: "",
  link: "",
  is_active: true,
  sort_order: 0,
};

function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return `${window.location.origin}${pathname}`;
  } catch {
    return `${window.location.origin}${url}`;
  }
}

export function BannersPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const createdIdRef = useRef<string | null>(null);

  const bannersQ = useQuery({
    queryKey: ["banners", user],
    queryFn: () => fetchBanners(user, password),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editId) {
        await updateBanner(user, password, editId, form);
        if (imageFile) await uploadBannerImage(user, password, editId, imageFile);
      } else {
        const created = await createBanner(user, password, form);
        if (imageFile) await uploadBannerImage(user, password, created.id, imageFile);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banners"] });
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBanner(user, password, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["banners"] }),
  });

  function startEdit(b: Banner) {
    setEditId(b.id);
    setForm({
      title: b.title,
      description: b.description,
      image_url: b.image_url,
      link: b.link,
      is_active: b.is_active,
      sort_order: b.sort_order,
    });
    setImageFile(null);
    setImagePreview(resolveImg(b.image_url));
    setShowForm(true);
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setEditId(null);
    setShowForm(false);
    setImageFile(null);
    setImagePreview(null);
  }

  const banners = bannersQ.data ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title="Баннеры"
        subtitle="Рекламные баннеры на главном экране клиентского приложения"
        action={
          !showForm && (
            <Btn onClick={() => setShowForm(true)}>+ Добавить баннер</Btn>
          )
        }
      />

      {showForm && (
        <Card className="p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">
            {editId ? "Редактировать баннер" : "Новый баннер"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Заголовок *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Весенние скидки"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Подробное описание акции или предложения"
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ссылка при нажатии</label>
              <input
                type="text"
                value={form.link}
                onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))}
                placeholder="https://... или /catalog/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Порядок отображения</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                style={{ fontSize: 16 }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Изображение баннера</label>
              <ImageUploadZone
                preview={imagePreview}
                onFile={(file, url) => { setImageFile(file); setImagePreview(url); }}
                inputId="banner-image"
              />
            </div>
            <div className="flex items-center sm:col-span-2">
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
              disabled={!form.title.trim() || saveMut.isPending}
            >
              {saveMut.isPending ? "Сохранение..." : editId ? "Сохранить" : "Создать"}
            </Btn>
            <button
              onClick={resetForm}
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
        </Card>
      )}

      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Баннеры</h2>
          <span className="text-xs text-gray-400">{banners.length} шт.</span>
        </div>

        {bannersQ.isLoading ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : banners.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">🖼️</p>
            <p className="text-sm">Нет баннеров — добавьте первый</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {banners.map((b) => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-16 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                  {b.image_url ? (
                    <img
                      src={resolveImg(b.image_url)!}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{b.title}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {b.is_active ? "активен" : "скрыт"}
                    </span>
                  </div>
                  {b.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{b.description}</p>
                  )}
                  <p className="text-xs text-indigo-500 mt-0.5">порядок: {b.sort_order}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(b)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => { if (confirm(`Удалить баннер «${b.title}»?`)) deleteMut.mutate(b.id); }}
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
