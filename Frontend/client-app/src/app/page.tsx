"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import TabBar, { type Tab } from "@/components/layout/TabBar";
import { useAuth } from "@/context/AuthContext";
import CatalogTab from "@/components/catalog/CatalogTab";
import StoresTab from "@/components/stores/StoresTab";
import CartTab from "@/components/cart/CartTab";
import ProfileTab from "@/components/profile/ProfileTab";
import FavoritesTab from "@/components/favorites/FavoritesTab";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("catalog");
  const [search, setSearch] = useState("");
  const { openAuthModal } = useAuth();

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
        onProfileClick={() => handleTabChange("profile")}
      />

      {/* TabBar: на десктопе под хедером, на мобильном — fixed bottom */}
      <TabBar active={activeTab} onChange={handleTabChange} />

      {/* pb-16 на мобильном — чтобы контент не перекрывался нижним TabBar */}
      <main className="flex-1 pb-16 md:pb-0">
        {activeTab === "catalog"   && <CatalogTab search={search} />}
        {activeTab === "stores"    && <StoresTab  search={search} />}
        {activeTab === "favorites" && <FavoritesTab />}
        {activeTab === "cart"      && <CartTab />}
        {activeTab === "profile"   && <ProfileTab onLogin={openAuthModal} />}
      </main>
    </div>
  );
}
