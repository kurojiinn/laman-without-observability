"use client";

import { useAuth } from "@/context/AuthContext";

interface HeaderProps {
  search: string;
  onSearchChange: (v: string) => void;
  showSearch: boolean;
  searchPlaceholder: string;
  onLogoClick: () => void;
  onProfileClick: () => void;
  activeCity: string;
  onCityClick: () => void;
  showGreeting?: boolean;
}

export default function Header({
  search,
  onSearchChange,
  showSearch,
  searchPlaceholder,
  onLogoClick,
  onProfileClick,
  activeCity,
  onCityClick,
  showGreeting,
}: HeaderProps) {
  const { isAuthenticated, user, openAuthModal } = useAuth();

  function handleProfileClick() {
    if (isAuthenticated) {
      onProfileClick();
    } else {
      openAuthModal();
    }
  }

  return (
    <header className="z-40" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Строка 1: логотип + [поиск на sm+] + город + профиль */}
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
          {showSearch && (
            <div className="hidden sm:flex flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-10 pl-9 pr-9 border border-gray-200 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                style={{ fontSize: 16, background: 'var(--bg-input)' }}
              />
              {search && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 transition-colors"
                >
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Spacer на мобильном */}
          <div className="flex-1 sm:hidden" />

          {/* Выбор города */}
          <button
            onClick={onCityClick}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold text-gray-800">{activeCity}</span>
            <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Профиль */}
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
          </button>
        </div>

        {/* Приветственный блок */}
        {showGreeting && (
          <div className="mb-3 px-1 py-2">
            <p className="text-2xl font-bold text-gray-900">{activeCity}</p>
            <p className="text-sm text-gray-500 mt-0.5">Доставим всё что нужно — быстро и удобно</p>
          </div>
        )}

        {/* Строка 2: поиск только на мобильном */}
        {showSearch && (
          <div className="sm:hidden pb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-10 pl-9 pr-9 border border-gray-200 rounded-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                style={{ fontSize: 16, background: 'var(--bg-input)' }}
              />
              {search && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 transition-colors"
                >
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 16 16" fill="none">
                    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

      </div>

    </header>
  );
}
