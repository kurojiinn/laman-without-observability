"use client";

import { useState } from "react";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { resolveImageUrl, type Product } from "@/lib/api";
import ProductModal from "@/components/ui/ProductModal";

export default function FavoritesTab({ search }: { search: string }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { favorites, loading, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const q = search.trim().toLowerCase();
  const visibleFavorites = q
    ? favorites.filter((p) => p.name.toLowerCase().includes(q))
    : favorites;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">🤍</span>
        <p className="text-base font-medium text-gray-500">Войдите, чтобы видеть избранное</p>
        <button
          onClick={openAuthModal}
          className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Войти
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-2xl aspect-[3/4] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <span className="text-6xl mb-4">🤍</span>
        <p className="text-base font-medium text-gray-500">Избранное пусто</p>
        <p className="text-sm text-gray-400 mt-1">Нажмите на сердечко у товара, чтобы добавить</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <p className="text-sm text-gray-400 mb-4">{favorites.length} {pluralize(favorites.length, "товар", "товара", "товаров")}</p>

      {visibleFavorites.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-5xl mb-3">🔍</span>
          <p className="text-sm">Ничего не найдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {visibleFavorites.map((product) => (
            <FavoriteCard
              key={product.id}
              product={product}
              onOpen={() => setSelectedProduct(product)}
              onAdd={() => addItem(product)}
              onRemove={() => toggleFavorite(product)}
            />
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

function FavoriteCard({
  product,
  onOpen,
  onAdd,
  onRemove,
}: {
  product: Product;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col cursor-pointer"
      onClick={onOpen}
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
        )}
        {/* Remove from favorites */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
          aria-label="Убрать из избранного"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-gray-400 mb-0.5 line-clamp-1">{product.description ?? ""}</p>
        <p className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{product.name}</p>
        <div className="flex items-center justify-between mt-2 gap-1">
          <span className="text-sm font-bold text-gray-900 min-w-0 truncate">
            {product.price.toLocaleString("ru-RU")} ₽
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="w-7 h-7 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full flex items-center justify-center transition-all text-sm font-bold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
