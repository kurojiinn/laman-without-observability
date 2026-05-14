"use client";

import { useEffect, useState } from "react";
import { isStoreOpen, type Store } from "@/lib/api";
import { useStores } from "@/lib/queries";
import StoreDetailView from "./StoreDetailView";
import { CATEGORY_META, DEFAULT_META } from "@/components/ui/CategoryIcon";
import StoreAvatar from "@/components/ui/StoreAvatar";
import { StoreGridSkeleton } from "@/components/ui/Skeleton";

interface Props {
  search: string;
}

export default function StoresTab({ search }: Props) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const { data: stores = [], isLoading: loading } = useStores(search || undefined);

  // Сбрасываем выбранный магазин при смене поиска
  useEffect(() => {
    setSelectedStore(null);
  }, [search]);

  if (selectedStore) {
    return (
      <StoreDetailView
        store={selectedStore}
        onBack={() => setSelectedStore(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <StoreGridSkeleton />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-5xl mb-4">🏪</span>
        <p className="text-sm">Магазины не найдены</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} onClick={() => setSelectedStore(store)} />
        ))}
      </div>
    </div>
  );
}

function StoreCard({ store, onClick }: { store: Store; onClick: () => void }) {
  const meta = CATEGORY_META[store.category_type ?? ""] ?? DEFAULT_META;
  const open = isStoreOpen(store);
  const hasHours = !!store.opens_at && !!store.closes_at;

  return (
    <button
      onClick={open ? onClick : undefined}
      className={`relative text-left bg-white rounded-2xl border p-5 transition-all flex flex-col gap-3 w-full overflow-hidden ${
        open ? "border-gray-100 hover:border-indigo-100 hover:shadow-md cursor-pointer" : "border-gray-200 cursor-not-allowed"
      }`}
    >
      {/* Затухший оверлей когда закрыто */}
      {!open && (
        <div className="absolute inset-0 bg-gray-100/55 rounded-2xl pointer-events-none z-10" />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StoreAvatar store={store} className="w-11 h-11 rounded-xl flex-shrink-0" textClass="text-xs" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{store.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{store.address}</p>
          </div>
        </div>

        {store.rating > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs font-semibold text-gray-700">{store.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${meta.badgeClass}`}>
          {meta.label}
        </span>
        {hasHours && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            open ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {open ? "Открыто" : "Закрыто"} · {store.opens_at}–{store.closes_at}
          </span>
        )}
      </div>

      <p className="text-xs text-indigo-500 font-medium">Открыть магазин →</p>
    </button>
  );
}
