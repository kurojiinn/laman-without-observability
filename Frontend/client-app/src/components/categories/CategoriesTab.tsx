"use client";

import { useEffect, useState } from "react";
import { catalogApi, resolveImageUrl, type Store } from "@/lib/api";
import StoreDetailView from "@/components/stores/StoreDetailView";
import CategoryIcon, { CATEGORY_META, DEFAULT_META } from "@/components/ui/CategoryIcon";
import StoreAvatar from "@/components/ui/StoreAvatar";

const STORE_CATEGORY_TYPES = ["PHARMACY", "FOOD", "BUILDING", "HOME", "CLOTHES", "AUTO"];

type View = "categories" | "stores" | "store";

export default function CategoriesTab() {
  const [view, setView] = useState<View>("categories");
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [activeCategoryType, setActiveCategoryType] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    catalogApi
      .getStores()
      .then((data) => setAllStores(data ?? []))
      .catch(() => setAllStores([]))
      .finally(() => setLoadingStores(false));
  }, []);

  // Категории с количеством магазинов
  const categoriesWithCount = STORE_CATEGORY_TYPES.map((type) => ({
    type,
    meta: CATEGORY_META[type] ?? DEFAULT_META,
    count: allStores.filter((s) => s.category_type === type).length,
  }));

  // Магазины выбранной категории с учётом поиска
  const filteredStores = allStores.filter((s) => {
    const matchesCategory = activeCategoryType ? s.category_type === activeCategoryType : true;
    const matchesSearch = search
      ? s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.address.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  // ── Просмотр конкретного магазина ──────────────────────────────────────────
  if (view === "store" && selectedStore) {
    return (
      <StoreDetailView
        store={selectedStore}
        onBack={() => {
          setSelectedStore(null);
          setView("stores");
        }}
      />
    );
  }

  // ── Список магазинов категории ─────────────────────────────────────────────
  if (view === "stores" && activeCategoryType) {
    const catMeta = CATEGORY_META[activeCategoryType] ?? DEFAULT_META;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <button
          onClick={() => { setView("categories"); setSearch(""); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-5"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Все категории
        </button>

        <div className="flex items-center gap-3 mb-4">
          <CategoryIcon type={activeCategoryType} size="md" />
          <h1 className="text-xl font-bold text-gray-900">{catMeta.label}</h1>
        </div>

        {/* Поиск по магазинам */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по магазинам..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all"
          />
        </div>

        {loadingStores ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400">
            <span className="text-5xl mb-3">🏪</span>
            <p className="text-sm">Магазины не найдены</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStores.map((store) => (
              <StoreRow
                key={store.id}
                store={store}
                onClick={() => { setSelectedStore(store); setView("store"); }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Сетка категорий ────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Категории</h1>

      {loadingStores ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {categoriesWithCount.map(({ type, meta, count }) => (
            <button
              key={type}
              onClick={() => { setActiveCategoryType(type); setView("stores"); }}
              className={`relative flex flex-col justify-between p-4 rounded-2xl bg-gradient-to-br ${meta.gridBg} hover:shadow-md transition-all text-left min-h-[110px]`}
            >
              <CategoryIcon type={type} size="md" />
              <div className="mt-2">
                <p className="text-sm font-bold text-gray-900 leading-tight">{meta.label}</p>
                {count > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{count} {pluralStore(count)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Все магазины */}
      {!loadingStores && allStores.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Все магазины</h2>
          <div className="space-y-3">
            {allStores.slice(0, 8).map((store) => (
              <StoreRow
                key={store.id}
                store={store}
                onClick={() => { setActiveCategoryType(null); setSelectedStore(store); setView("store"); }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Store Row (для списка магазинов) ─────────────────────────────────────────

function StoreRow({ store, onClick }: { store: Store; onClick: () => void }) {
  const meta = CATEGORY_META[store.category_type] ?? DEFAULT_META;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:shadow-md hover:border-indigo-100 transition-all flex items-center gap-4"
    >
      <StoreAvatar store={store} className="w-12 h-12 rounded-xl" textClass="text-sm" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm leading-tight">{store.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{store.address}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {store.rating > 0 && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs font-semibold text-gray-700">{store.rating.toFixed(1)}</span>
          </div>
        )}
        <svg className="w-4 h-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  );
}

function pluralStore(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "магазин";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "магазина";
  return "магазинов";
}
