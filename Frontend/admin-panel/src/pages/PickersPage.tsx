import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPicker, deletePicker, fetchPickers, fetchStores, updatePicker } from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input, Select } from "../components/Layout";
import type { Picker } from "../api/admin";

interface Props {
  user: string;
  password: string;
}

export function PickersPage({ user, password }: Props) {
  const qc = useQueryClient();

  const pickersQ = useQuery({
    queryKey: ["pickers"],
    queryFn: () => fetchPickers(user, password),
  });
  const storesQ = useQuery({ queryKey: ["stores"], queryFn: fetchStores });

  const storeOptions = useMemo(
    () => (storesQ.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    [storesQ.data],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", password: "", store_id: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<Picker | null>(null);
  const [editStoreID, setEditStoreID] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Picker | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      createPicker(user, password, {
        phone: form.phone.trim(),
        password: form.password.trim(),
        store_id: form.store_id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickers"] });
      setCreateOpen(false);
      setForm({ phone: "", password: "", store_id: "" });
      setShowPassword(false);
      setCreateError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : "Ошибка создания");
      setCreateError(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePicker(user, password, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickers"] });
      setDeleteTarget(null);
    },
  });

  const editMut = useMutation({
    mutationFn: () =>
      updatePicker(user, password, editTarget!.id, { store_id: editStoreID }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pickers"] });
      setEditTarget(null);
      setEditError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : "Ошибка");
      setEditError(msg);
    },
  });

  function openEdit(p: Picker) {
    setEditTarget(p);
    setEditStoreID(p.store_id);
    setEditError(null);
  }

  function openCreate() {
    setForm({ phone: "", password: "", store_id: storeOptions[0]?.value ?? "" });
    setCreateError(null);
    setShowPassword(false);
    setCreateOpen(true);
  }

  function submitCreate() {
    setCreateError(null);
    if (!form.phone.trim() || !form.password.trim() || !form.store_id) {
      setCreateError("Заполните все поля");
      return;
    }
    if (form.password.trim().length < 6) {
      setCreateError("Пароль минимум 6 символов");
      return;
    }
    createMut.mutate();
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Сборщики"
        subtitle="Управление аккаунтами PICKER"
        action={
          <Btn onClick={openCreate} disabled={storesQ.isLoading || storeOptions.length === 0}>
            + Добавить сборщика
          </Btn>
        }
      />

      <Card>
        {pickersQ.isLoading ? (
          <p className="px-5 py-4 text-sm text-gray-500">Загрузка...</p>
        ) : pickersQ.data && pickersQ.data.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {pickersQ.data.map((p) => (
              <li
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{p.phone}</p>
                  <p className="text-xs text-gray-500">
                    {p.store_name || "Магазин не найден"}
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString("ru-RU")}
                </p>
                <div className="flex gap-2">
                  <Btn variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    Изменить
                  </Btn>
                  <Btn variant="danger" size="sm" onClick={() => setDeleteTarget(p)}>
                    Удалить
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Сборщиков пока нет. Добавьте первого.
          </p>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый сборщик"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1 justify-center">
              Отмена
            </Btn>
            <Btn onClick={submitCreate} disabled={createMut.isPending} className="flex-1 justify-center">
              {createMut.isPending ? "Создаём..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input
          label="Телефон"
          value={form.phone}
          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          placeholder="79001234567"
        />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Пароль</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="минимум 6 символов"
              className="w-full px-3 py-2 pr-20 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              style={{ fontSize: 16 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-indigo-500 hover:text-indigo-700 px-2 py-1"
            >
              {showPassword ? "Скрыть" : "Показать"}
            </button>
          </div>
        </div>
        <Select
          label="Магазин"
          value={form.store_id}
          onChange={(v) => setForm((f) => ({ ...f, store_id: v }))}
          options={storeOptions}
          placeholder="Выберите магазин"
        />
        {createError && <p className="text-xs text-red-500">{createError}</p>}
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Изменить магазин"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditTarget(null)} className="flex-1 justify-center">
              Отмена
            </Btn>
            <Btn
              onClick={() => editMut.mutate()}
              disabled={editMut.isPending || !editStoreID}
              className="flex-1 justify-center"
            >
              {editMut.isPending ? "Сохраняем..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        {editTarget && (
          <>
            <div>
              <p className="text-xs text-gray-500 mb-1">Сборщик</p>
              <p className="text-sm font-semibold text-gray-900">{editTarget.phone}</p>
            </div>
            <Select
              label="Магазин"
              value={editStoreID}
              onChange={setEditStoreID}
              options={storeOptions}
            />
            {editError && <p className="text-xs text-red-500">{editError}</p>}
          </>
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Удалить сборщика?"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1 justify-center">
              Отмена
            </Btn>
            <Btn
              variant="danger"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
              className="flex-1 justify-center"
            >
              {deleteMut.isPending ? "Удаляем..." : "Удалить"}
            </Btn>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              Удалить аккаунт <span className="font-semibold">{deleteTarget.phone}</span> из магазина{" "}
              <span className="font-semibold">{deleteTarget.store_name}</span>?
            </p>
            <p className="text-xs text-gray-400">
              Заказы, которые он собирал, останутся в системе, но потеряют привязку к этому
              сборщику. Действие необратимо.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
