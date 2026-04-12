"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import TabBar, { type Tab } from "@/components/layout/TabBar";
import HomeTab from "@/components/home/HomeTab";
import CategoriesTab from "@/components/categories/CategoriesTab";
import CartTab from "@/components/cart/CartTab";
import FavoritesTab from "@/components/favorites/FavoritesTab";
import ProfileDrawer from "@/components/profile/ProfileDrawer";
import StoreDetailView from "@/components/stores/StoreDetailView";
import { catalogApi, type Store } from "@/lib/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [profileOpen, setProfileOpen] = useState(false);

  // Магазин открытый с главной через «Показать в магазине»
  const [openStore, setOpenStore] = useState<Store | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string | undefined>(undefined);

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
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setOpenStore(null); // сбрасываем открытый магазин при смене таба
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        search=""
        onSearchChange={() => {}}
        onLogoClick={() => handleTabChange("home")}
        onCartClick={() => handleTabChange("cart")}
        onProfileClick={() => setProfileOpen(true)}
      />

      <TabBar active={activeTab} onChange={handleTabChange} />

      <main className="flex-1 pb-16 md:pb-0">
        {/* Магазин открытый с главной — показываем внутри main (хедер и таббар остаются) */}
        {openStore ? (
          <StoreDetailView store={openStore} onBack={handleCloseStore} targetProductId={targetProductId} />
        ) : storeLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === "home"       && <HomeTab onOpenStore={handleOpenStore} />}
            {activeTab === "categories" && <CategoriesTab />}
            {activeTab === "favorites"  && <FavoritesTab />}
            {activeTab === "cart"       && <CartTab />}
          </>
        )}
      </main>

      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
