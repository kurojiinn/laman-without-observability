"use client";

import { useCart } from "@/context/CartContext";

export type Tab = "catalog" | "stores" | "favorites" | "cart" | "categories";

const TABS: {
  id: Tab;
  label: string;
  shortLabel: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: "catalog",
    label: "Каталог",
    shortLabel: "Каталог",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: "stores",
    label: "Магазины",
    shortLabel: "Магазины",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    id: "favorites",
    label: "Избранное",
    shortLabel: "Избранное",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    id: "cart",
    label: "Корзина",
    shortLabel: "Корзина",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "categories",
    label: "Категории",
    shortLabel: "Категории",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
];

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabBar({ active, onChange }: TabBarProps) {
  const { totalCount } = useCart();

  return (
    <>
      {/* ── Мобильный: фиксированный bottom-nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 pb-safe"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 h-16">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            const showBadge = tab.id === "cart" && totalCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  isActive ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                <div className="relative">
                  {tab.icon(isActive)}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {totalCount > 9 ? "9+" : totalCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-medium leading-none ${isActive ? "text-indigo-600" : "text-gray-400"}`}>
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Десктоп: горизонтальные вкладки под хедером ── */}
      <nav className="hidden md:block bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            const showBadge = tab.id === "cart" && totalCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                {tab.icon(isActive)}
                {tab.label}
                {showBadge && (
                  <span className="ml-1 px-1.5 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full leading-none">
                    {totalCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
