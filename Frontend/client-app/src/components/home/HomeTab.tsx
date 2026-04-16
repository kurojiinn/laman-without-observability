"use client";

import { useEffect, useState } from "react";
import { catalogApi, resolveImageUrl, type Product, type Store } from "@/lib/api";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import ProductModal from "@/components/ui/ProductModal";

interface Props {
  onOpenStore: (storeId: string, productId?: string) => void;
  search: string;
  activeCity: string;
}

export default function HomeTab({ onOpenStore, search, activeCity }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeMap, setStoreMap] = useState<Record<string, Store>>({});
  const [loading, setLoading] = useState(true);
  const [charityOpen, setCharityOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    Promise.all([
      catalogApi.getFeatured("new_items"),
      catalogApi.getStores(),
    ])
      .then(([prods, stores]) => {
        setProducts(prods ?? []);
        const map: Record<string, Store> = {};
        (stores ?? []).forEach((s) => { map[s.id] = s; });
        setStoreMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();

  // Оставляем только товары из магазинов выбранного города
  const cityProducts = products.filter((p) => storeMap[p.store_id]?.city === activeCity);

  const visibleProducts = q
    ? cityProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q),
      )
    : cityProducts;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">

      {/* ── Промо-баннер ── */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-500 p-5 text-white flex items-center justify-between min-h-[100px]">
        <div>
          <p className="text-xs font-medium opacity-80 mb-1">Доставка в Грозном</p>
          <h2 className="text-xl font-bold leading-tight">Всё что нужно —<br />привезём за 30 мин</h2>
          <p className="text-xs opacity-70 mt-2">Продукты, аптека, стройматериалы и не только</p>
        </div>
        <div className="text-5xl ml-4 flex-shrink-0">🚀</div>
      </div>

      {/* ── Блок благотворительности ── */}
      <button
        onClick={() => setCharityOpen(true)}
        className="w-full text-left rounded-2xl overflow-hidden relative hover:opacity-95 active:scale-[0.99] transition-all"
        style={{ background: "linear-gradient(135deg, #92400e 0%, #b45309 40%, #d97706 100%)" }}
      >
        {/* Декоративные круги */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-10 bg-white" />

        <div className="relative px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest opacity-60">Laman Добро</span>
                <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">Скоро</span>
              </div>
              <p className="text-lg font-bold leading-snug mb-1">
                Делимся теплом<br />с теми, кому нужно
              </p>
              <p className="text-xs opacity-75 leading-relaxed">
                Оставь любую сумму — мы купим продукты<br />и принесём их нуждающимся в Грозном
              </p>
            </div>
            <span className="text-4xl flex-shrink-0">🫶</span>
          </div>

          <div className="flex items-center gap-1.5 mt-4">
            <span className="text-xs font-semibold opacity-90">Узнать подробнее</span>
            <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </button>

      {/* ── Новинки ── */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-3">
          {q ? "Результаты поиска" : "Новинки"}
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <span className="text-5xl mb-3">{q ? "🔍" : "🛍️"}</span>
            <p className="text-sm">{q ? "Ничего не найдено" : "Товары скоро появятся"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {visibleProducts.slice(0, 10).map((product) => (
              <HomeProductCard
                key={product.id}
                product={product}
                storeName={storeMap[product.store_id]?.name}
                onOpen={() => setSelectedProduct(product)}
                onShowInStore={() => onOpenStore(product.store_id, product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          storeName={storeMap[selectedProduct.store_id]?.name}
          onClose={() => setSelectedProduct(null)}
          onGoToStore={() => {
            onOpenStore(selectedProduct.store_id, selectedProduct.id);
            setSelectedProduct(null);
          }}
        />
      )}

      {/* ── Модальное окно благотворительности ── */}
      {charityOpen && <CharityModal onClose={() => setCharityOpen(false)} />}
    </div>
  );
}

// ─── Карточка товара на главной ────────────────────────────────────────────────

function HomeProductCard({
  product,
  storeName,
  onOpen,
  onShowInStore,
}: {
  product: Product;
  storeName?: string;
  onOpen: () => void;
  onShowInStore: () => void;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated, openAuthModal } = useAuth();
  const fav = isFavorite(product.id);

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isAuthenticated) { openAuthModal(); return; }
    toggleFavorite(product);
  }

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow cursor-pointer"
      onClick={onOpen}
    >
      {/* Сердечко */}
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
          <img src={resolveImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 gap-1">
        {storeName && (
          <p className="text-[10px] text-gray-400 font-medium truncate">{storeName}</p>
        )}
        <p className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 flex-1 leading-tight break-words">{product.name}</p>
        <p className="text-sm font-bold text-gray-900 mt-1">
          {product.price.toLocaleString("ru-RU")} ₽
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onShowInStore(); }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          В магазин
        </button>
      </div>
    </div>
  );
}

// ─── Модальное окно благотворительности ───────────────────────────────────────

function CharityModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div
          className="relative px-6 pt-7 pb-10 text-white overflow-hidden"
          style={{ background: "linear-gradient(135deg, #92400e 0%, #b45309 40%, #d97706 100%)" }}
        >
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-white" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10 bg-white" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative">
            <span className="text-4xl">🫶</span>
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Laman Добро</p>
              <h2 className="text-2xl font-bold leading-tight">Делимся теплом</h2>
              <p className="text-sm opacity-80 mt-1 leading-relaxed">
                Каждый рубль — это чья-то тарелка еды
              </p>
            </div>
          </div>
        </div>

        {/* Контент */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            В Грозном, как и в любом городе, есть люди, которым сейчас тяжело. Пожилые, многодетные семьи, те, кто оказался в сложной ситуации — им не хватает самого необходимого.
          </p>

          <div className="space-y-2.5">
            {[
              { icon: "🥖", title: "Еда",          desc: "Хлеб, крупы, консервы, молоко" },
              { icon: "🧴", title: "Гигиена",       desc: "Мыло, шампунь, зубная паста" },
              { icon: "🧥", title: "Тёплые вещи",  desc: "Одежда и одеяла в холода" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-3">
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">{title}</p>
                  <p className="text-xs text-amber-700 opacity-80">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-gray-500 leading-relaxed">
              Каждый рубль идёт напрямую на покупку — без комиссий и посредников. Отчёт о покупках публикуется открыто.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 font-bold rounded-2xl transition-all active:scale-[0.98] text-white"
            style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}
          >
            Буду рад помочь ❤️
          </button>

          <p className="text-[11px] text-gray-400 text-center -mt-1">
            Функция пожертвования появится совсем скоро
          </p>
        </div>
      </div>
    </div>
  );
}
