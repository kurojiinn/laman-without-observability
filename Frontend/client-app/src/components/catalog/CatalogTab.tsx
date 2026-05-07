"use client";

import { useEffect, useState } from "react";
import { catalogApi, resolveImageUrl, type Category, type Subcategory, type Product } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import ProductModal from "@/components/ui/ProductModal";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";

// Эмодзи и цвета для категорий — хранятся на фронте, не в БД.
// Причина: иконки — это UI-деталь, не бизнес-данные.
// Ключ совпадает с полем name категории в БД.
const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  "Продукты":       { emoji: "🛒", color: "bg-green-50 border-green-100"  },
  "Аптека":         { emoji: "💊", color: "bg-red-50 border-red-100"      },
  "Стройматериалы": { emoji: "🔨", color: "bg-orange-50 border-orange-100"},
  "Химия":          { emoji: "🧴", color: "bg-blue-50 border-blue-100"    },
};

interface Props {
  search: string;
}

export default function CatalogTab({ search }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [activeSubcat, setActiveSubcat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Загружаем корневые категории один раз
  useEffect(() => {
    catalogApi.getCategories()
      .then((data) => setCategories(data ?? []))
      .catch(() => {});
  }, []);

  // Когда выбрана категория — загружаем её подкатегории
  useEffect(() => {
    if (!activeCat) {
      setSubcategories([]);
      setActiveSubcat(null);
      return;
    }
    catalogApi.getSubcategories(activeCat.id)
      .then((data) => setSubcategories(data ?? []))
      .catch(() => setSubcategories([]));
    setActiveSubcat(null);
  }, [activeCat]);

  // Загружаем товары при изменении фильтров
  useEffect(() => {
    setLoading(true);
    catalogApi
      .getProducts({
        category_id: activeCat?.id,
        subcategory_id: activeSubcat ?? undefined,
        search: search || undefined,
      })
      .then((data) => setProducts(data ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [activeCat, activeSubcat, search]);

  function handleCategoryClick(cat: Category) {
    // Повторный клик по активной категории — сбрасываем выбор
    if (activeCat?.id === cat.id) {
      setActiveCat(null);
    } else {
      setActiveCat(cat);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

      {/* ── Блоки категорий ── */}
      {categories.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat.name] ?? { emoji: "📦", color: "bg-gray-50 border-gray-100" };
            const isActive = activeCat?.id === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                  isActive
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md scale-[0.97]"
                    : `${meta.color} text-gray-700 hover:shadow-sm`
                }`}
              >
                <span className="text-2xl sm:text-3xl leading-none">{meta.emoji}</span>
                <span className={`text-[11px] sm:text-xs font-medium text-center leading-tight ${isActive ? "text-white" : "text-gray-600"}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Подкатегории — скролл-пилюли ── */}
      {activeCat && subcategories.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <SubcatPill
            label="Все"
            active={activeSubcat === null}
            onClick={() => setActiveSubcat(null)}
          />
          {subcategories.map((sc) => (
            <SubcatPill
              key={sc.id}
              label={sc.name}
              active={activeSubcat === sc.id}
              onClick={() => setActiveSubcat(sc.id)}
            />
          ))}
        </div>
      )}

      {/* ── Товары ── */}
      {loading ? (
        <ProductSkeleton />
      ) : products.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={() => setSelectedProduct(p)} />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

function SubcatPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function ProductCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const { addItem, items } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated, openAuthModal } = useAuth();
  const cartItem = items.find((i) => i.product.id === product.id);
  const fav = isFavorite(product.id);

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isAuthenticated) { openAuthModal(); return; }
    toggleFavorite(product);
  }

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
      onClick={onOpen}
    >
      <button
        onClick={handleFav}
        className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={fav ? "#ef4444" : "none"} stroke={fav ? "#ef4444" : "#9ca3af"} strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      <div className="aspect-square bg-gray-50 overflow-hidden">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-0.5 line-clamp-1">{product.description ?? ""}</p>
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{product.name}</p>
        <div className="flex items-center justify-between mt-2 gap-1">
          <span className="text-sm font-bold text-gray-900 min-w-0 truncate">
            {product.price.toLocaleString("ru-RU")} ₽
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); addItem(product); }}
            className="w-7 h-7 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full flex items-center justify-center transition-all text-sm font-bold"
          >
            +
          </button>
        </div>
        {cartItem && (
          <p className="text-xs text-indigo-500 mt-1">В корзине: {cartItem.quantity} шт.</p>
        )}
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-2xl aspect-[3/4] animate-pulse" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
      <span className="text-5xl mb-4">🔍</span>
      <p className="text-sm">Товары не найдены</p>
    </div>
  );
}
