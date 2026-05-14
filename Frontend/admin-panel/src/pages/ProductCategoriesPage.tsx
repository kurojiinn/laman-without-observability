import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  fetchAdminCategories,
  updateCategory,
  updateSubcategory,
} from "../api/admin";
import { PageHeader, Card, Btn, Modal, Input } from "../components/Layout";
import type { Category } from "../types";

interface Props { user: string; password: string; }

// Цель переименования/удаления — либо главная категория, либо подкатегория.
type EditTarget = { kind: "category" | "subcategory"; id: string; name: string };

export function ProductCategoriesPage({ user, password }: Props) {
  const qc = useQueryClient();
  const categoriesQ = useQuery({ queryKey: ["admin-categories"], queryFn: () => fetchAdminCategories(user, password) });

  // Создание главной категории
  const [createCatOpen, setCreateCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Создание подкатегории (parent — выбранная главная категория)
  const [subParent, setSubParent] = useState<Category | null>(null);
  const [newSubName, setNewSubName] = useState("");

  // Переименование
  const [renameTarget, setRenameTarget] = useState<EditTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Удаление
  const [deleteTarget, setDeleteTarget] = useState<EditTarget | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-categories"] });

  const createCatMut = useMutation({
    mutationFn: () => createCategory(user, password, newCatName.trim()),
    onSuccess: () => { invalidate(); setCreateCatOpen(false); setNewCatName(""); },
  });

  const createSubMut = useMutation({
    mutationFn: () => createSubcategory(user, password, subParent!.id, newSubName.trim()),
    onSuccess: () => { invalidate(); setSubParent(null); setNewSubName(""); },
  });

  const renameMut = useMutation({
    mutationFn: () => {
      const t = renameTarget!;
      return t.kind === "category"
        ? updateCategory(user, password, t.id, renameValue.trim())
        : updateSubcategory(user, password, t.id, renameValue.trim());
    },
    onSuccess: () => { invalidate(); setRenameTarget(null); setRenameValue(""); },
  });

  const deleteMut = useMutation({
    mutationFn: () => {
      const t = deleteTarget!;
      return t.kind === "category"
        ? deleteCategory(user, password, t.id)
        : deleteSubcategory(user, password, t.id);
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  const categories = categoriesQ.data ?? [];
  const deleteChildrenCount =
    deleteTarget?.kind === "category"
      ? (categories.find((c) => c.id === deleteTarget.id)?.children?.length ?? 0)
      : 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Категории товаров"
        subtitle="Двухуровневое дерево категорий и подкатегорий для товаров магазинов"
        action={
          <Btn onClick={() => setCreateCatOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Добавить главную категорию
          </Btn>
        }
      />

      {categoriesQ.isLoading ? (
        <div className="px-5 py-10 text-center text-gray-400 text-sm">Загрузка...</div>
      ) : categories.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400">
          <p className="text-3xl mb-2">🏷️</p>
          <p className="text-sm">Категорий пока нет. Добавьте первую.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const children = cat.children ?? [];
            return (
              <Card key={cat.id} className="p-4">
                {/* Главная категория */}
                <div className="flex items-center gap-3">
                  <p className="font-bold text-gray-900 text-sm flex-1">{cat.name}</p>
                  <span className="text-xs text-gray-400">
                    {children.length} {children.length === 1 ? "подкатегория" : "подкатегорий"}
                  </span>
                  <Btn size="sm" variant="ghost" onClick={() => { setSubParent(cat); setNewSubName(""); }}>
                    + Подкатегория
                  </Btn>
                  <Btn size="sm" variant="secondary" onClick={() => { setRenameTarget({ kind: "category", id: cat.id, name: cat.name }); setRenameValue(cat.name); }}>
                    Изменить
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => setDeleteTarget({ kind: "category", id: cat.id, name: cat.name })}>
                    Удалить
                  </Btn>
                </div>

                {/* Подкатегории */}
                {children.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-gray-100 space-y-1.5">
                    {children.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 py-1">
                        <span className="text-gray-300">└</span>
                        <p className="text-sm text-gray-700 flex-1">{sub.name}</p>
                        <Btn size="sm" variant="secondary" onClick={() => { setRenameTarget({ kind: "subcategory", id: sub.id, name: sub.name }); setRenameValue(sub.name); }}>
                          Изменить
                        </Btn>
                        <Btn size="sm" variant="danger" onClick={() => setDeleteTarget({ kind: "subcategory", id: sub.id, name: sub.name })}>
                          Удалить
                        </Btn>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Модалка: создать главную категорию */}
      <Modal
        open={createCatOpen}
        onClose={() => { setCreateCatOpen(false); setNewCatName(""); }}
        title="Новая главная категория"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCreateCatOpen(false)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => createCatMut.mutate()} disabled={createCatMut.isPending || !newCatName.trim()} className="flex-1">
              {createCatMut.isPending ? "Создание..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={newCatName} onChange={setNewCatName} placeholder="Например: Напитки" />
        {createCatMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>

      {/* Модалка: создать подкатегорию */}
      <Modal
        open={!!subParent}
        onClose={() => { setSubParent(null); setNewSubName(""); }}
        title={`Подкатегория в «${subParent?.name ?? ""}»`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setSubParent(null)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => createSubMut.mutate()} disabled={createSubMut.isPending || !newSubName.trim()} className="flex-1">
              {createSubMut.isPending ? "Создание..." : "Создать"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={newSubName} onChange={setNewSubName} placeholder="Например: Вода" />
        {createSubMut.isError && <p className="text-xs text-red-500">Ошибка создания</p>}
      </Modal>

      {/* Модалка: переименовать */}
      <Modal
        open={!!renameTarget}
        onClose={() => { setRenameTarget(null); setRenameValue(""); }}
        title={renameTarget?.kind === "category" ? "Переименовать категорию" : "Переименовать подкатегорию"}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRenameTarget(null)} className="flex-1">Отмена</Btn>
            <Btn onClick={() => renameMut.mutate()} disabled={renameMut.isPending || !renameValue.trim()} className="flex-1">
              {renameMut.isPending ? "Сохранение..." : "Сохранить"}
            </Btn>
          </>
        }
      >
        <Input label="Название *" value={renameValue} onChange={setRenameValue} />
        {renameMut.isError && <p className="text-xs text-red-500">Ошибка сохранения</p>}
      </Modal>

      {/* Модалка: удалить */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.kind === "category" ? "Удалить категорию?" : "Удалить подкатегорию?"}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Отмена</Btn>
            <Btn variant="danger" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending} className="flex-1">
              {deleteMut.isPending ? "Удаление..." : "Удалить"}
            </Btn>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Удалить {deleteTarget?.kind === "category" ? "категорию" : "подкатегорию"}{" "}
          <strong>«{deleteTarget?.name}»</strong>?
        </p>
        {deleteTarget?.kind === "category" && deleteChildrenCount > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ Внутри <strong>{deleteChildrenCount}</strong>{" "}
            {deleteChildrenCount === 1 ? "подкатегория" : "подкатегорий"} — они тоже будут удалены.
            Товары останутся, но потеряют привязку к подкатегории.
          </p>
        )}
        {deleteTarget?.kind === "subcategory" && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ Товары этой подкатегории останутся, но потеряют привязку к ней.
          </p>
        )}
        {deleteMut.isError && <p className="text-xs text-red-500 mt-2">Ошибка удаления</p>}
      </Modal>
    </div>
  );
}
