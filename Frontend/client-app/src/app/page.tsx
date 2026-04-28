"use client";

import { useState } from "react";
import { useBodyScrollLockWhen } from "@/hooks/useBodyScrollLock";
import Header from "@/components/layout/Header";
import TabBar, { type Tab } from "@/components/layout/TabBar";
import HomeTab from "@/components/home/HomeTab";
import CategoriesTab from "@/components/categories/CategoriesTab";
import CartTab from "@/components/cart/CartTab";
import FavoritesTab from "@/components/favorites/FavoritesTab";
import ProfileDrawer from "@/components/profile/ProfileDrawer";
import StoreDetailView from "@/components/stores/StoreDetailView";
import { catalogApi, type Store } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CITIES = ["Ойсхар", "Грозный"];

const SEARCH_PLACEHOLDERS: Record<Tab, string> = {
  home:       "Хлеб, молоко, лекарства...",
  categories: "Поиск магазинов...",
  favorites:  "Поиск в избранном...",
  cart:       "",
};

const STORE_SEARCH_PLACEHOLDER = "Поиск товаров в магазине...";

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCity, setActiveCity] = useState(CITIES[0]);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  useBodyScrollLockWhen(cityModalOpen);

  // Магазин открытый с главной через «Показать в магазине»
  const [openStore, setOpenStore] = useState<Store | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState("");

  function handleOpenStore(storeId: string, productId?: string) {
    setTargetProductId(productId);
    setStoreLoading(true);
    catalogApi
      .getStore(storeId)
      .then(setOpenStore)
      .catch(() => setOpenStore(null))
      .finally(() => setStoreLoading(false));
  }

  function handleCloseStore() {
    setOpenStore(null);
    setTargetProductId(undefined);
    setSort("");
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setOpenStore(null);
    setSearch("");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-page)' }}>
      <Header
        search={search}
        onSearchChange={setSearch}
        showSearch={activeTab !== "cart"}
        searchPlaceholder={openStore ? STORE_SEARCH_PLACEHOLDER : SEARCH_PLACEHOLDERS[activeTab]}
        onLogoClick={() => handleTabChange("home")}
        onProfileClick={() => setProfileOpen(true)}
        activeCity={activeCity}
        onCityClick={() => setCityModalOpen(true)}
        showGreeting={activeTab === "home" && !openStore && !storeLoading}
        showSort={!!openStore}
        sort={sort}
        onSortChange={setSort}
      />

      <TabBar active={activeTab} onChange={handleTabChange} isAdmin={isAdmin} />

      <main className="flex-1 pb-16 md:pb-0">
        {/* Магазин открытый с главной — показываем внутри main (хедер и таббар остаются) */}
        {openStore ? (
          <StoreDetailView store={openStore} onBack={handleCloseStore} targetProductId={targetProductId} search={search} sort={sort} isAdmin={isAdmin} />
        ) : storeLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "home"       && <HomeTab onOpenStore={handleOpenStore} onGoToCart={() => handleTabChange("cart")} search={search} activeCity={activeCity} />}
            {activeTab === "categories" && <CategoriesTab search={search} activeCity={activeCity} />}
            {activeTab === "favorites"  && <FavoritesTab search={search} />}
            {activeTab === "cart"       && <CartTab onGoToStore={(storeId, productId) => { handleTabChange("home"); handleOpenStore(storeId, productId); }} />}
          </>
        )}
      </main>

      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onGoToCart={() => { setProfileOpen(false); handleTabChange("cart"); }}
      />

      {cityModalOpen && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/50 overflow-hidden" onClick={() => setCityModalOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 sm:inset-0 z-[9999] flex items-end sm:items-center justify-center pointer-events-none"
            onClick={() => setCityModalOpen(false)}
          >
          <div
            className="pointer-events-auto w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Выберите город</h2>
              <button
                onClick={() => setCityModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-3 space-y-1">
              {CITIES.map((city) => (
                <button
                  key={city}
                  onClick={() => { setActiveCity(city); setCityModalOpen(false); }}
                  className={`w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition-colors ${
                    activeCity === city ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span className={`text-sm font-semibold ${activeCity === city ? "text-indigo-700" : "text-gray-700"}`}>
                      {city}
                    </span>
                  </div>
                  {activeCity === city && (
                    <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <div className="h-4" />
          </div>
          </div>
        </>
      )}
    </div>
  );
}
