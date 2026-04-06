"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import TabBar, { type Tab } from "@/components/layout/TabBar";
import CatalogTab from "@/components/catalog/CatalogTab";
import StoresTab from "@/components/stores/StoresTab";
import CartTab from "@/components/cart/CartTab";
import FavoritesTab from "@/components/favorites/FavoritesTab";
import CategoriesTab from "@/components/categories/CategoriesTab";
import ProfileDrawer from "@/components/profile/ProfileDrawer";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("catalog");
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearch("");
  };

  const searchActive = activeTab === "catalog" || activeTab === "stores";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        search={searchActive ? search : ""}
        onSearchChange={setSearch}
        onLogoClick={() => handleTabChange("catalog")}
        onCartClick={() => handleTabChange("cart")}
        onProfileClick={() => setProfileOpen(true)}
      />

      <TabBar active={activeTab} onChange={handleTabChange} />

      <main className="flex-1 pb-16 md:pb-0">
        {activeTab === "catalog"   && <CatalogTab search={search} />}
        {activeTab === "stores"    && <StoresTab  search={search} />}
        {activeTab === "favorites" && <FavoritesTab />}
        {activeTab === "cart"       && <CartTab />}
        {activeTab === "categories" && <CategoriesTab />}
      </main>

      {/* Личный кабинет — drawer поверх экрана, не таб */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
