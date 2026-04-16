import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStore, deleteStore, fetchStores } from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select, ImageUploadZone } from "../components/Layout";
import type { Store, StoreCategoryType } from "../types";
import { STORE_CATEGORY_LABELS } from "../types";

interface Props { user: string; password: string; }

const CATEGORY_OPTIONS = Object.entries(STORE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
const CITY_OPTIONS = [
  { value: "Грозный", label: "Грозный" },
  { value: "Ойсхар", label: "Ойсхар" },
];

export function StoresPage({ user, password }: Props) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);

  const [form, setForm] = useState({
    name: "", address: "", city: "Грозный",
    category_type: "FOOD" as StoreCategoryType, description: "",
    image_url: "",
  });

  const storesQ = useQuery({ queryKey: ["stores"], queryFn: fetchStores });

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
      setCreateOpen(false);
      setForm({ name: "", address: "", city: "Грозный", category_type: "FOOD", description: "", image_url: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStore(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stores"] });
      setDeleteTarget(null);
    },
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Магазины"
        subtitle={`Всего: ${storesQ.data?.length ?? "—"}`}
        action={
          <Btn onClick={() => setCreateOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Название", "Адрес", "Город", "Категория", "Рейтинг", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-5 py-3 first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storesQ.data.map((store) => (
                  <tr key={store.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-900">{store.name}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{store.address}</td>
                    <td className="px-5 py-3 text-gray-600">{store.city ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        {STORE_CATEGORY_LABELS[store.category_type] ?? store.category_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        {store.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Btn variant="danger" size="sm" onClick={() => setDeleteTarget(store)}>Удалить</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create modal */}
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
        <Select label="Тип магазина" value={form.category_type} onChange={(v) => setForm((p) => ({ ...p, category_type: v as StoreCategoryType }))} options={CATEGORY_OPTIONS} />
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

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить магазин?"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Отмена</Btn>
            <Btn
              variant="danger"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
              className="flex-1"
            >
              {deleteMut.isPending ? "Удаление..." : "Удалить"}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Вы уверены, что хотите удалить магазин <strong>«{deleteTarget?.name}»</strong>?
          Все связанные товары будут удалены.
        </p>
        {deleteMut.isError && <p className="text-xs text-red-500">Ошибка удаления</p>}
      </Modal>
    </div>
  );
}
