"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/context/CartContext";

export type Tab = "home" | "categories" | "favorites" | "cart";

const TABS: {
  id: Tab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    id: "home",
    label: "Главная",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: "categories",
    label: "Категории",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: "favorites",
    label: "Избранное",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    id: "cart",
    label: "Корзина",
    icon: (active) => (
      <svg className={`w-6 h-6 ${active ? "text-indigo-600" : "text-gray-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  isAdmin?: boolean;
}

/**
 * Возвращает true на ~550ms когда totalCount УВЕЛИЧИЛСЯ.
 * Используется для триггера cart-bounce анимации иконки.
 * Уменьшение (удаление товара) не анимируется — это не требует визуального
 * подкрепления.
 */
function useCartBounce(totalCount: number): boolean {
  const [bouncing, setBouncing] = useState(false);
  const prev = useRef(totalCount);

  useEffect(() => {
    if (totalCount > prev.current) {
      setBouncing(true);
      const t = setTimeout(() => setBouncing(false), 550);
      return () => clearTimeout(t);
    }
    prev.current = totalCount;
  }, [totalCount]);

  return bouncing;
}

export default function TabBar({ active, onChange, isAdmin }: TabBarProps) {
  const { totalCount } = useCart();
  const bounce = useCartBounce(totalCount);

  const visibleTabs = isAdmin ? TABS.filter((t) => t.id === "home" || t.id === "categories") : TABS;
  const colCount = visibleTabs.length;

  return (
    <>
      {/* ── Мобильный: фиксированный bottom-nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div className={`grid h-16`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
          {visibleTabs.map((tab) => {
            const isActive = active === tab.id;
            const showBadge = tab.id === "cart" && totalCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                  isActive ? "text-indigo-600" : "text-gray-400"
                }`}
              >
                <div className={`relative ${tab.id === "cart" && bounce ? "animate-cart-bounce" : ""}`}>
                  {tab.icon(isActive)}
                  {showBadge && (
                    <span
                      key={totalCount}
                      className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-badge-pop"
                    >
                      {totalCount > 9 ? "9+" : totalCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-medium leading-none ${isActive ? "text-indigo-600" : "text-gray-400"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Десктоп: горизонтальные вкладки под хедером ── */}
      <nav className="hidden md:block border-b border-gray-100" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {visibleTabs.map((tab) => {
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
                <span className={tab.id === "cart" && bounce ? "inline-flex animate-cart-bounce" : "inline-flex"}>
                  {tab.icon(isActive)}
                </span>
                {tab.label}
                {showBadge && (
                  <span
                    key={totalCount}
                    className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-xs font-bold rounded-full leading-none animate-badge-pop"
                  >
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
