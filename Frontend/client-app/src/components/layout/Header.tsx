"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

interface HeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  onLogoClick: () => void;
  onCartClick: () => void;
}

export default function Header({
  search,
  onSearchChange,
  onLogoClick,
  onCartClick,
}: HeaderProps) {
  const { isAuthenticated, user, openAuthModal, logout } = useAuth();
  const { totalCount } = useCart();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleProfileClick() {
    if (isAuthenticated) {
      setDropdownOpen((v) => !v);
    } else {
      openAuthModal();
    }
  }

  function handleLogout() {
    logout();
    setDropdownOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Строка 1: логотип + [поиск на sm+] + корзина + профиль */}
        <div className="flex items-center gap-3 h-14">

          {/* Логотип */}
          <button
            onClick={onLogoClick}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Laman</span>
          </button>

          {/* Поиск — только на sm+ в первой строке */}
          <div className="hidden sm:flex flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск товаров и магазинов..."
              className="w-full h-10 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* Spacer на мобильном */}
          <div className="flex-1 sm:hidden" />

          {/* Корзина */}
          <button onClick={onCartClick} className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {totalCount > 9 ? "9+" : totalCount}
              </span>
            )}
          </button>

          {/* Профиль */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                {isAuthenticated ? (
                  <span className="text-xs font-bold text-indigo-600">{user?.phone.slice(-2)}</span>
                ) : (
                  <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-gray-600 hidden sm:block">
                {isAuthenticated ? "Кабинет" : "Войти"}
              </span>
              {isAuthenticated && (
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform hidden sm:block ${dropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {isAuthenticated && dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                <div className="px-4 py-4 bg-indigo-50 border-b border-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{user?.phone}</p>
                      <p className="text-xs text-indigo-500 font-medium mt-0.5">
                        {user?.role === "CLIENT" ? "Клиент" : user?.role}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <InfoRow label="Телефон" value={user?.phone ?? "—"} />
                  <InfoRow label="Роль" value={user?.role === "CLIENT" ? "Клиент" : user?.role ?? "—"} />
                  <InfoRow label="ID" value={user?.id ? `${user.id.slice(0, 8)}…` : "—"} mono />
                </div>
                <div className="px-4 pb-4">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                    </svg>
                    Выйти из аккаунта
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Строка 2: поиск только на мобильном */}
        <div className="sm:hidden pb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск товаров и магазинов..."
              className="w-full h-10 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
        </div>

      </div>
    </header>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs text-gray-700 font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
