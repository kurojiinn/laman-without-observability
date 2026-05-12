import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOptionGroup,
  createOptionValue,
  deleteOptionGroup,
  deleteOptionValue,
  fetchProductOptionGroups,
} from "../api/admin";
import type { OptionGroup, OptionValue } from "../api/admin";
import { Btn, Input, Select } from "./Layout";

interface Props {
  user: string;
  password: string;
  productId: string;
  basePrice: number; // показываем итоговую цену = base + delta
}

const KIND_OPTIONS = [
  { value: "variant", label: "Влияет на цену (порция, размер)" },
  { value: "flag", label: "Просто метка (острый/нет, без цены)" },
];

export function ProductOptionsEditor({ user, password, productId, basePrice }: Props) {
  const qc = useQueryClient();
  const groupsQ = useQuery({
    queryKey: ["option-groups", productId],
    queryFn: () => fetchProductOptionGroups(user, password, productId),
  });

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupKind, setNewGroupKind] = useState<"variant" | "flag">("variant");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["option-groups", productId] });

  const createGroupMut = useMutation({
    mutationFn: () => createOptionGroup(user, password, productId, {
      name: newGroupName.trim(),
      kind: newGroupKind,
      is_required: true,
    }),
    onSuccess: () => { invalidate(); setNewGroupName(""); },
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: string) => deleteOptionGroup(user, password, id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">
          Опции показываются клиенту в карточке товара. «Порция» меняет цену, «острый/нет» — нет.
        </p>
      </div>

      {/* Создание новой группы */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Название группы"
            value={newGroupName}
            onChange={setNewGroupName}
            placeholder="Например: Порция, Острота"
          />
          <Select
            label="Тип"
            value={newGroupKind}
            onChange={(v) => setNewGroupKind(v as "variant" | "flag")}
            options={KIND_OPTIONS}
          />
        </div>
        <Btn
          size="sm"
          onClick={() => createGroupMut.mutate()}
          disabled={!newGroupName.trim() || createGroupMut.isPending}
        >
          + Добавить группу опций
        </Btn>
      </div>

      {/* Список групп */}
      {groupsQ.isLoading ? (
        <p className="text-xs text-gray-400">Загрузка...</p>
      ) : (groupsQ.data ?? []).length === 0 ? (
        <p className="text-xs text-gray-400">Опций пока нет</p>
      ) : (
        <div className="space-y-3">
          {groupsQ.data!.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              basePrice={basePrice}
              user={user}
              password={password}
              onChange={invalidate}
              onDelete={() => {
                if (confirm(`Удалить группу «${group.name}» и все её значения?`)) {
                  deleteGroupMut.mutate(group.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group, basePrice, user, password, onChange, onDelete,
}: {
  group: OptionGroup;
  basePrice: number;
  user: string;
  password: string;
  onChange: () => void;
  onDelete: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDelta, setNewDelta] = useState("");
  const isVariant = group.kind === "variant";

  const createValMut = useMutation({
    mutationFn: () => createOptionValue(user, password, group.id, {
      name: newName.trim(),
      price_delta: isVariant && newDelta !== "" ? Number(newDelta) : null,
    }),
    onSuccess: () => {
      onChange();
      setNewName("");
      setNewDelta("");
    },
  });

  const deleteValMut = useMutation({
    mutationFn: (id: string) => deleteOptionValue(user, password, id),
    onSuccess: onChange,
  });

  return (
    <div className="border border-gray-100 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{group.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">
            {isVariant ? "Влияет на цену" : "Метка для пикера"}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="text-xs text-rose-500 hover:text-rose-600 font-semibold"
        >
          Удалить
        </button>
      </div>

      {/* Значения */}
      {group.values.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">Значений пока нет</p>
      ) : (
        <div className="space-y-1 mb-2">
          {group.values.map((v) => (
            <ValueRow
              key={v.id}
              value={v}
              basePrice={basePrice}
              isVariant={isVariant}
              onDelete={() => deleteValMut.mutate(v.id)}
            />
          ))}
        </div>
      )}

      {/* Добавление значения */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="Значение"
            value={newName}
            onChange={setNewName}
            placeholder={isVariant ? "6 шт" : "Острый"}
          />
        </div>
        {isVariant && (
          <div className="w-28">
            <Input
              label="± к цене"
              type="number"
              value={newDelta}
              onChange={setNewDelta}
              placeholder="0"
            />
          </div>
        )}
        <Btn
          size="sm"
          onClick={() => createValMut.mutate()}
          disabled={!newName.trim() || createValMut.isPending}
        >
          +
        </Btn>
      </div>
    </div>
  );
}

function ValueRow({
  value, basePrice, isVariant, onDelete,
}: {
  value: OptionValue;
  basePrice: number;
  isVariant: boolean;
  onDelete: () => void;
}) {
  const finalPrice = isVariant && value.price_delta != null ? basePrice + value.price_delta : null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1">{value.name}</span>
      {isVariant && value.price_delta != null && (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {value.price_delta > 0 ? `+${value.price_delta}` : value.price_delta} ₽
          {finalPrice != null && <span className="text-gray-400"> → {finalPrice} ₽</span>}
        </span>
      )}
      {isVariant && value.price_delta == null && (
        <span className="text-xs text-gray-400 whitespace-nowrap">базовая цена</span>
      )}
      <button onClick={onDelete} className="text-xs text-rose-500 hover:text-rose-600">
        ×
      </button>
    </div>
  );
}
