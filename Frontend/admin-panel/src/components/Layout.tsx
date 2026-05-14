import { useState } from "react";

export type Page = "dashboard" | "stores" | "products" | "vitrina" | "recipes" | "orders" | "scenarios" | "categories" | "product-categories" | "pickers";

interface NavItem {
  id: Page;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Дашборд", icon: "📊" },
  { id: "stores", label: "Магазины", icon: "🏪" },
  { id: "products", label: "Товары", icon: "📦" },
  { id: "vitrina", label: "Витрина", icon: "✨" },
  { id: "recipes", label: "Рецепты", icon: "👨‍🍳" },
  { id: "orders", label: "Заказы", icon: "📋" },
  { id: "scenarios", label: "Сценарии", icon: "🎬" },
  { id: "categories", label: "Категории магазинов", icon: "🗂️" },
  { id: "product-categories", label: "Категории товаров", icon: "🏷️" },
  { id: "pickers", label: "Сборщики", icon: "👤" },
];

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  user: string;
  children: React.ReactNode;
}

export function Layout({ page, onNavigate, onLogout, user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-900 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            Y
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Yuher Admin</p>
            <p className="text-gray-400 text-xs">Панель управления</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                page === item.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
              {page === item.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold uppercase">
              {user[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user}</p>
              <p className="text-gray-500 text-[10px]">Администратор</p>
            </div>
            <button
              onClick={onLogout}
              title="Выйти"
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center text-white font-bold text-xs">Y</div>
            <span className="font-bold text-sm text-gray-900">Yuher Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "danger" | "ghost" | "secondary";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base = "inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white",
    danger: "bg-rose-500 hover:bg-rose-600 text-white",
    ghost: "bg-gray-100 hover:bg-gray-200 text-gray-700",
    secondary: "border border-gray-200 hover:bg-gray-50 text-gray-700",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        style={{ fontSize: 16 }}
      />
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
        style={{ fontSize: 16 }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  if (!open) return null;
  const widths = { md: "sm:max-w-md", lg: "sm:max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`bg-white w-full ${widths[size]} rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImageUploadZone({
  preview,
  onFile,
  inputId,
}: {
  preview: string | null;
  onFile: (f: File, url: string) => void;
  inputId: string;
}) {
  return (
    <div
      className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file, URL.createObjectURL(file));
      }}
      onClick={() => document.getElementById(inputId)?.click()}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file, URL.createObjectURL(file));
        }}
      />
      {preview ? (
        <div className="flex flex-col items-center gap-2">
          <img src={preview} alt="preview" className="h-24 w-24 rounded-xl object-cover shadow" />
          <span className="text-xs text-gray-400">Нажми чтобы сменить</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 text-gray-400">
          <svg className="w-8 h-8 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <span className="text-sm font-medium">Перетащите фото</span>
          <span className="text-xs">или нажмите для выбора</span>
        </div>
      )}
    </div>
  );
}

export function ProductSearchInput({
  value,
  name,
  onSelect,
  onClear,
  searchResults,
  isSearching,
}: {
  value: string;
  name: string;
  onSelect: (id: string, name: string) => void;
  onClear: () => void;
  searchResults: { id: string; name: string; price: number }[];
  isSearching: boolean;
}) {
  const [show, setShow] = useState(false);

  if (value) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
        <span className="text-sm font-medium text-indigo-800">{name}</span>
        <button type="button" onClick={onClear} className="text-xs text-indigo-500 hover:text-indigo-700">Сменить</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={name}
        onChange={(e) => { onClear(); setShow(true); onSelect("", e.target.value); }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder="Введите название товара..."
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        style={{ fontSize: 16 }}
      />
      {show && name.trim().length >= 2 && (
        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {isSearching && <p className="px-3 py-2 text-sm text-gray-400">Поиск...</p>}
          {!isSearching && searchResults.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Ничего не найдено</p>
          )}
          {searchResults.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => { onSelect(p.id, p.name); setShow(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between"
            >
              <span className="text-sm font-medium text-gray-800">{p.name}</span>
              <span className="text-xs text-gray-400">{p.price.toLocaleString("ru-RU")} ₽</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
