"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { catalogApi, resolveImageUrl, type Product, type Store, type RecipeWithProducts, type Scenario } from "@/lib/api";
import { useStores, useScenarios, useFeatured, useRecipes } from "@/lib/queries";
import { useCart } from "@/context/CartContext";
import ProductModal from "@/components/ui/ProductModal";
import { FeaturedRowSkeleton, ScenariosSkeleton, SectionHeaderSkeleton } from "@/components/ui/Skeleton";
import { ErrorBoundary, SectionErrorFallback } from "@/components/ui/ErrorBoundary";

type ShowcaseKey = "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook";

interface ShowcaseBlock {
  key: ShowcaseKey;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
}

const SHOWCASES: Record<ShowcaseKey, ShowcaseBlock> = {
  new_items:   { key: "new_items",   title: "Новинки",         subtitle: "Свежие поступления",          emoji: "✨", gradient: "from-indigo-500 to-violet-600" },
  hits:        { key: "hits",        title: "Популярное",      subtitle: "Хиты продаж",                 emoji: "🔥", gradient: "from-orange-400 to-rose-500" },
  movie_night: { key: "movie_night", title: "Для кино",        subtitle: "Идеально под фильм",          emoji: "🍿", gradient: "from-purple-600 to-pink-500" },
  quick_snack: { key: "quick_snack", title: "Быстрый перекус", subtitle: "Когда хочется прямо сейчас",  emoji: "⚡", gradient: "from-yellow-400 to-amber-500" },
  lazy_cook:   { key: "lazy_cook",   title: "Лень готовить",   subtitle: "Готовые решения без усилий",  emoji: "😴", gradient: "from-sky-400 to-blue-600" },
};

interface Props {
  onOpenStore: (storeId: string, productId?: string, categoryId?: string) => void;
  onGoToCart: () => void;
  search: string;
  activeCity: string;
}

export default function HomeTab({ onOpenStore, onGoToCart, search, activeCity }: Props) {
  const [charityOpen, setCharityOpen] = useState(false);
  const [openShowcase, setOpenShowcase] = useState<ShowcaseKey | null>(null);
  const [showcaseProducts, setShowcaseProducts] = useState<Product[]>([]);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [openRecipesModal, setOpenRecipesModal] = useState(false);
  const [openRecipe, setOpenRecipe] = useState<RecipeWithProducts | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: stores = [] } = useStores();
  const { data: scenariosData = [], isLoading: scenariosLoading } = useScenarios();
  const { data: newItemsData = [], isLoading: newItemsLoading } = useFeatured("new_items");
  const { data: hitsData = [], isLoading: hitsLoading } = useFeatured("hits");
  const { data: recipesData = [], isLoading: recipesLoading } = useRecipes();

  // Кешируем построение storeMap чтобы не пересоздавать на каждый ререндер
  const storeMap = useMemo(() => {
    const map: Record<string, Store> = {};
    stores.forEach((s) => { map[s.id] = s; });
    return map;
  }, [stores]);

  const scenarios = scenariosData ?? [];
  const newItems = newItemsData ?? [];
  const hits = hitsData ?? [];
  const recipes = recipesData ?? [];

  function handleOpenShowcase(key: ShowcaseKey) {
    setOpenShowcase(key);
    setShowcaseLoading(true);
    catalogApi.getFeatured(key)
      .then((data) => setShowcaseProducts(Array.isArray(data) ? data : []))
      .catch(() => setShowcaseProducts([]))
      .finally(() => setShowcaseLoading(false));
  }

  function handleOpenRecipe(recipeId: string) {
    setRecipeLoading(true);
    catalogApi.getRecipe(recipeId)
      .then(setOpenRecipe)
      .catch(() => {})
      .finally(() => setRecipeLoading(false));
  }

  const q = search.trim().toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-6" style={{ color: 'inherit' }}>

      {q ? (
        <SearchResults q={q} activeCity={activeCity} storeMap={storeMap} onOpenStore={onOpenStore} onOpenProduct={setSelectedProduct} />
      ) : (
        <>
          {/* ── Промо-карусель ── */}
          <PromoBannerCarousel />

          {/* ── Быстрые сценарии ── */}
          {scenariosLoading ? (
            <section>
              <SectionHeaderSkeleton />
              <ScenariosSkeleton />
            </section>
          ) : scenarios.length > 0 && (
            <ErrorBoundary fallback={<SectionErrorFallback message="Не удалось загрузить сценарии" />}>
            <section>
                              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-900">Быстрые сценарии</h2>
                <button className="text-sm font-semibold text-indigo-500">Все &rsaquo;</button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {scenarios.map((sc) => (
                  <ScenarioCard
                    key={sc.id}
                    scenario={sc}
                    onClick={() => handleOpenShowcase(sc.section_key as ShowcaseKey)}
                  />
                ))}
              </div>
            </section>
            </ErrorBoundary>
          )}

          {/* ── Новинки ── */}
          {newItemsLoading ? (
            <section>
              <SectionHeaderSkeleton />
              <FeaturedRowSkeleton />
            </section>
          ) : newItems.length > 0 && (
            <ErrorBoundary fallback={<SectionErrorFallback message="Не удалось загрузить новинки" />}>
              <FeaturedSection
                title="Новинки"
                emoji="✨"
                products={newItems}
                storeMap={storeMap}
                activeCity={activeCity}
                onViewAll={() => handleOpenShowcase("new_items")}
                onOpenProduct={setSelectedProduct}
                onOpenStore={onOpenStore}
                badge="new"
              />
            </ErrorBoundary>
          )}

          {/* ── Популярное ── */}
          {hitsLoading ? (
            <section>
              <SectionHeaderSkeleton />
              <FeaturedRowSkeleton />
            </section>
          ) : hits.length > 0 && (
            <ErrorBoundary fallback={<SectionErrorFallback message="Не удалось загрузить популярное" />}>
              <FeaturedSection
                title="Популярное"
                emoji="🔥"
                products={hits}
                storeMap={storeMap}
                activeCity={activeCity}
                onViewAll={() => handleOpenShowcase("hits")}
                onOpenProduct={setSelectedProduct}
                onOpenStore={onOpenStore}
                badge="hot"
              />
            </ErrorBoundary>
          )}

          {/* ── Рецепты ── */}
          {recipesLoading ? (
            <div className="bg-gray-200 rounded-2xl h-32 animate-pulse" />
          ) : recipes.length > 0 && (
            <ErrorBoundary fallback={<SectionErrorFallback message="Не удалось загрузить рецепты" />}>
              <RecipesBanner
                recipes={recipes}
                onOpen={() => setOpenRecipesModal(true)}
                onOpenRecipe={handleOpenRecipe}
                recipeLoading={recipeLoading}
              />
            </ErrorBoundary>
          )}

          {/* ── Благотворительность (пока неактивно — серая заглушка) ── */}
          <button
            onClick={() => setCharityOpen(true)}
            className="w-full text-left rounded-2xl overflow-hidden relative active:scale-[0.99] transition-all border border-gray-200 bg-gray-100"
          >
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-30 bg-gray-200" />
            <div className="relative px-4 py-3 flex items-center gap-3 text-gray-500">
              <span className="text-2xl flex-shrink-0 grayscale opacity-70">🫶</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold leading-none text-gray-600">Делимся теплом с теми, кому нужно</p>
                  <span className="text-[10px] font-semibold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0">Скоро</span>
                </div>
                <p className="text-[11px] opacity-80 mt-0.5 truncate">Купим продукты нуждающимся в Чеченской Республике</p>
              </div>
              <svg className="w-4 h-4 opacity-40 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        </>
      )}

      {openShowcase && (
        <ShowcasePage
          block={SHOWCASES[openShowcase] ?? { key: openShowcase, title: openShowcase, subtitle: "", emoji: "⚡", gradient: "from-indigo-500 to-violet-600" }}
          products={showcaseProducts}
          loading={showcaseLoading}
          storeMap={storeMap}
          activeCity={activeCity}
          onClose={() => { setOpenShowcase(null); setShowcaseProducts([]); }}
          onOpenProduct={setSelectedProduct}
          onOpenStore={onOpenStore}
        />
      )}

      {/* ── Все рецепты ── */}
      {openRecipesModal && (
        <RecipesModal
          recipes={recipes}
          storeMap={storeMap}
          activeCity={activeCity}
          onClose={() => setOpenRecipesModal(false)}
          onOpenRecipe={handleOpenRecipe}
          recipeLoading={recipeLoading}
        />
      )}

      {/* ── Детальный рецепт ── */}
      {openRecipe && (
        <RecipeDetailModal
          recipe={openRecipe}
          storeMap={storeMap}
          activeCity={activeCity}
          onClose={() => setOpenRecipe(null)}
          onOpenProduct={setSelectedProduct}
          onGoToCart={() => { setOpenRecipe(null); setOpenRecipesModal(false); onGoToCart(); }}
        />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          storeName={storeMap[selectedProduct.store_id]?.name}
          onClose={() => setSelectedProduct(null)}
          onGoToStore={() => {
            onOpenStore(selectedProduct.store_id, selectedProduct.id, selectedProduct.category_id);
            setSelectedProduct(null);
          }}
        />
      )}

      {charityOpen && <CharityModal onClose={() => setCharityOpen(false)} />}
    </div>
  );
}

// ─── ScenarioCard ─────────────────────────────────────────────────────────────

function ScenarioCard({ scenario, onClick }: { scenario: Scenario; onClick: () => void }) {
  const imgSrc = scenario.image_url ? resolveImageUrl(scenario.image_url, "hero") ?? null : null;

  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden active:scale-[0.96] transition-all"
    >
      {imgSrc ? (
        <img src={imgSrc} alt={scenario.label} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-violet-600" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
        <p className="text-white text-xs font-bold leading-tight line-clamp-1">{scenario.label}</p>
        {scenario.subtitle && (
          <p className="text-white/70 text-[10px] leading-tight line-clamp-1 mt-0.5">{scenario.subtitle}</p>
        )}
      </div>
    </button>
  );
}

// ─── FeaturedSection ─────────────────────────────────────────────────────────

function FeaturedSection({
  title,
  emoji,
  products,
  storeMap,
  activeCity,
  onViewAll,
  onOpenProduct,
  onOpenStore,
  badge,
}: {
  title: string;
  emoji: string;
  products: Product[];
  storeMap: Record<string, Store>;
  activeCity: string;
  onViewAll: () => void;
  onOpenProduct: (p: Product) => void;
  onOpenStore: (storeId: string, productId?: string, categoryId?: string) => void;
  badge?: "new" | "hot";
}) {
  const visible = products
    .filter((p) => storeMap[p.store_id]?.city === activeCity)
    .slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">{emoji} {title}</h2>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-full text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Смотреть все &rsaquo;
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {visible.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            storeName={storeMap[product.store_id]?.name}
            onOpen={() => onOpenProduct(product)}
            onShowInStore={() => onOpenStore(product.store_id, product.id, product.category_id)}
            badge={badge}
          />
        ))}
      </div>
    </section>
  );
}

// ─── RecipesBanner ────────────────────────────────────────────────────────────

function RecipesBanner({ recipes, onOpen, onOpenRecipe, recipeLoading }: {
  recipes: RecipeWithProducts[];
  onOpen: () => void;
  onOpenRecipe: (id: string) => void;
  recipeLoading: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl overflow-hidden relative active:scale-[0.98] transition-all"
      style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
    >
      <div className="relative p-4 flex gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">🤌 РЕЦЕПТЫ</p>
          <h3 className="text-lg font-extrabold text-white leading-tight">Что приготовить сегодня?</h3>
          <p className="text-white/70 text-xs mt-1">Идеи блюд и всё нужное добавим в корзину</p>
          <span className="inline-block mt-3 px-4 py-1.5 bg-black/50 rounded-full text-white text-xs font-semibold">
            Смотреть рецепты
          </span>
        </div>
        <div className="flex-shrink-0 flex flex-col gap-1.5 justify-center">
          {recipes.slice(0, 2).map((r) => (
            <div
              key={r.id}
              onClick={(e) => { e.stopPropagation(); if (!recipeLoading) onOpenRecipe(r.id); }}
              className="flex items-center gap-2 bg-white/15 rounded-xl px-2 py-1.5 cursor-pointer active:bg-white/25 transition-colors"
            >
              {r.image_url ? (
                <img src={resolveImageUrl(r.image_url, "thumb")} alt={r.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" loading="lazy" />
              ) : (
                <span className="w-8 h-8 flex items-center justify-center text-lg flex-shrink-0">🍽️</span>
              )}
              <div className="min-w-0">
                <p className="text-white text-[11px] font-semibold truncate max-w-[90px]">{r.name}</p>
                <p className="text-white/60 text-[10px]">{r.products.length} ингр.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

// ─── Promo Banner Carousel ────────────────────────────────────────────────────

const WA_LINK = "https://wa.me/79640691596";

const PROMO_BANNERS = [
  {
    id: "idea",
    tag: "Поделитесь",
    headline: "Есть идея? 🎯",
    sub: "Помогите сделать Yuhher лучше — какой магазин добавить, чего не хватает?",
    emoji: "💡",
    bg: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1e40af 100%)",
    dotColor: "#3b82f6",
    chipColor: "bg-blue-500/20 text-blue-200",
    chips: ["Магазины", "Идеи", "Фидбэк"],
    modal: {
      title: "Есть идея?", emoji: "🎯",
      headerBg: "linear-gradient(135deg, #0f172a, #1e40af)",
      body: [
        { icon: "🏪", title: "Какой магазин добавить", desc: "Любимое место, до которого долго ездить" },
        { icon: "💡", title: "Идеи и предложения", desc: "Что добавить или улучшить в сервисе" },
        { icon: "🐛", title: "Что-то не работает", desc: "Расскажите — починим как можно скорее" },
      ],
      cta: "Написать в WhatsApp", ctaBg: "#25D366",
      ctaAction: WA_LINK, hideCta: false,
    },
  },
  {
    id: "partner",
    tag: "Для бизнеса",
    headline: "Добавь свой\nмагазин в Yuhher",
    sub: "Тысячи клиентов — без затрат на доставку",
    emoji: "🤝",
    bg: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)",
    dotColor: "#34d399",
    chipColor: "bg-emerald-400/20 text-emerald-200",
    chips: ["Бесплатное подключение", "Своя аналитика", "Поддержка 24/7"],
    modal: {
      title: "Стать партнёром", emoji: "🤝",
      headerBg: "linear-gradient(135deg, #064e3b, #059669)",
      body: [
        { icon: "🏪", title: "Любой магазин", desc: "Продукты, аптека, хозтовары, стройматериалы" },
        { icon: "📈", title: "Больше продаж", desc: "Ваш магазин увидят тысячи покупателей" },
        { icon: "💰", title: "Прозрачная комиссия", desc: "Честные условия без скрытых платежей" },
      ],
      cta: "Написать в WhatsApp", ctaBg: "linear-gradient(135deg, #065f46, #059669)",
      ctaAction: WA_LINK, hideCta: false,
    },
  },
  {
    id: "app",
    tag: "Удобнее",
    headline: "Yuhher на\nглавном экране",
    sub: "Без App Store — работает как приложение",
    emoji: "📲",
    bg: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    dotColor: "#67e8f9",
    chipColor: "bg-cyan-400/20 text-cyan-200",
    chips: ["iOS", "Android", "Без скачивания"],
    modal: {
      title: "Добавить на экран", emoji: "📲",
      headerBg: "linear-gradient(135deg, #0f2027, #2c5364)",
      body: [
        { icon: "🍎", title: "На iPhone", desc: "Нажмите «Поделиться» → «На экран Домой»" },
        { icon: "🤖", title: "На Android", desc: "Меню браузера (⋮) → «Добавить на главный экран»" },
        { icon: "⚡", title: "Как приложение", desc: "Открывается без браузера, работает быстро" },
      ],
      cta: "", ctaBg: "", ctaAction: "", hideCta: true,
    },
  },
];

type PromoBannerType = typeof PROMO_BANNERS[number];

function PromoBannerCarousel() {
  const [index, setIndex] = useState(0);
  const [openBanner, setOpenBanner] = useState<PromoBannerType | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  function startInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setIndex((i) => (i + 1) % PROMO_BANNERS.length), 6_000);
  }

  useEffect(() => {
    startInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function go(dir: 1 | -1) {
    setIndex((i) => (i + dir + PROMO_BANNERS.length) % PROMO_BANNERS.length);
    startInterval();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) { didSwipe.current = true; go(delta < 0 ? 1 : -1); }
    touchStartX.current = null;
  }

  const banner = PROMO_BANNERS[index];

  return (
    <>
      <div className="select-none rounded-2xl overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {PROMO_BANNERS.map((b) => (
            <button key={b.id} onClick={() => { if (!didSwipe.current) setOpenBanner(b); }} className="relative w-full flex-shrink-0 text-left overflow-hidden" style={{ background: b.bg }}>
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/5" />
              <div className="relative px-4 pt-3 pb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-widest text-white/50 mb-1">{b.tag}</span>
                  <h2 className="text-[14px] font-extrabold text-white leading-snug whitespace-pre-line">{b.headline}</h2>
                  <p className="text-white/60 text-[10px] mt-1 leading-relaxed">{b.sub}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {b.chips.slice(0, 3).map((chip) => (
                      <span key={chip} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${b.chipColor}`}>{chip}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="text-[30px] leading-none">{b.emoji}</span>
                  <span className="text-white/40 text-[9px] font-medium flex items-center gap-0.5">
                    Подробнее
                    <svg className="w-2 h-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: banner.bg }}>
          <button onClick={(e) => { e.stopPropagation(); go(-1); }} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex gap-2">
            {PROMO_BANNERS.map((_, i) => (
              <button key={i} onClick={() => { setIndex(i); startInterval(); }} className="transition-all duration-300" style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, background: i === index ? banner.dotColor : "rgba(255,255,255,0.3)" }} />
            ))}
          </div>
          <button onClick={(e) => { e.stopPropagation(); go(1); }} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      {openBanner && <PromoModal banner={openBanner} onClose={() => { setOpenBanner(null); startInterval(); }} />}
    </>
  );
}

function PromoModal({ banner, onClose }: { banner: PromoBannerType; onClose: () => void }) {
  useBodyScrollLock();
  const { style: swipeStyle, backdropStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose });
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm" onClick={onClose} style={backdropStyle} />
      <div className="fixed inset-0 z-[9001] flex items-end sm:items-center justify-center pointer-events-none">
      <div className="pointer-events-auto relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl" style={swipeStyle} onClick={(e) => e.stopPropagation()}>
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center py-2.5 flex-shrink-0 touch-none select-none cursor-grab" {...swipeHandlers}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="relative px-6 pt-7 pb-6 text-white overflow-hidden sm:touch-auto touch-none select-none" style={{ background: banner.modal.headerBg }} {...swipeHandlers}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <div className="relative">
            <span className="text-5xl">{banner.modal.emoji}</span>
            <h2 className="text-2xl font-extrabold mt-3 leading-tight">{banner.modal.title}</h2>
          </div>
        </div>
        <div className="px-5 py-5 space-y-3">
          {banner.modal.body.map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl px-4 py-3 bg-gray-50">
              <span className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-6">
          {banner.modal.hideCta ? (
            <p className="text-center text-xs text-gray-400 leading-relaxed">Добавьте на главный экран — и Yuhher всегда под рукой</p>
          ) : (
            <button onClick={() => window.open(banner.modal.ctaAction, "_blank", "noopener")} className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all active:scale-[0.98]" style={{ background: banner.modal.ctaBg }}>
              {banner.modal.cta}
            </button>
          )}
        </div>
      </div>
      </div>
    </>,
    document.body
  );
}

// ─── ShowcasePage (full-screen) ───────────────────────────────────────────────

function ShowcasePage({
  block, products, loading, storeMap, activeCity, onClose, onOpenProduct, onOpenStore,
}: {
  block: ShowcaseBlock;
  products: Product[];
  loading: boolean;
  storeMap: Record<string, Store>;
  activeCity: string;
  onClose: () => void;
  onOpenProduct: (p: Product) => void;
  onOpenStore: (storeId: string, productId?: string, categoryId?: string) => void;
}) {
  useBodyScrollLock();
  const { style: swipeStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose, threshold: 80, direction: "right" });
  const visibleProducts = products.filter((p) => storeMap[p.store_id]?.city === activeCity);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* handlers на весь wrapper — gesture detection отличает свайп вправо от вертикального скролла */}
      <div className="flex flex-col h-full bg-white animate-slide-in-right" style={swipeStyle} {...swipeHandlers}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-4 border-b border-gray-100 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <button onClick={onClose} className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors flex-shrink-0">
            <svg className="w-4 h-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">{block.emoji} {block.title}</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-gray-100 rounded-2xl h-52 animate-pulse" />)}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <span className="text-5xl mb-3">🛍️</span>
              <p className="text-sm">Товары скоро появятся</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {visibleProducts.map((product) => (
                <HomeProductCard
                  key={product.id}
                  product={product}
                  storeName={storeMap[product.store_id]?.name}
                  onOpen={() => onOpenProduct(product)}
                  onShowInStore={() => { onClose(); onOpenStore(product.store_id, product.id, product.category_id); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Recipes Modal ────────────────────────────────────────────────────────────

function RecipesModal({
  recipes, storeMap: _storeMap, activeCity: _activeCity, onClose, onOpenRecipe, recipeLoading,
}: {
  recipes: RecipeWithProducts[];
  storeMap: Record<string, Store>;
  activeCity: string;
  onClose: () => void;
  onOpenRecipe: (id: string) => void;
  recipeLoading: boolean;
}) {
  useBodyScrollLock();
  const { style: swipeStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose, threshold: 80, direction: "right" });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      <div className="flex flex-col h-full bg-white animate-slide-in-right" style={swipeStyle} {...swipeHandlers}>
      <div className="flex items-center gap-3 px-4 pb-4 border-b border-gray-100 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <button onClick={onClose} className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors flex-shrink-0">
          <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold text-white">👨‍🍳 Рецепты</h1>
          <p className="text-white/70 text-xs">Выбери блюдо и собери ингредиенты</p>
        </div>
      </div>
      <div className="overflow-y-auto overscroll-contain flex-1 p-4 bg-gray-50">
        <div className="grid grid-cols-2 gap-3">
          {recipes.map((recipe) => (
            <button key={recipe.id} onClick={() => onOpenRecipe(recipe.id)} disabled={recipeLoading} className="text-left bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex flex-col">
              <div className="aspect-square w-full bg-gray-50 overflow-hidden flex items-center justify-center">
                {recipe.image_url ? (
                  <img src={resolveImageUrl(recipe.image_url, "card")} alt={recipe.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-5xl">🍽️</span>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1 gap-1">
                <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{recipe.name}</p>
                {recipe.description && <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{recipe.description}</p>}
                <div className="flex items-center gap-1 mt-auto pt-2">
                  <span className="text-xs text-emerald-600 font-semibold">Собрать блюдо</span>
                  <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Recipe Detail Modal ──────────────────────────────────────────────────────

function RecipeDetailModal({
  recipe, storeMap, activeCity, onClose, onOpenProduct, onGoToCart,
}: {
  recipe: RecipeWithProducts;
  storeMap: Record<string, Store>;
  activeCity: string;
  onClose: () => void;
  onOpenProduct: (p: Product) => void;
  onGoToCart: () => void;
}) {
  const { addItem, removeItem } = useCart();
  const [addedAll, setAddedAll] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  useBodyScrollLock();

  const cityProducts = recipe.products.filter((p) => storeMap[p.store_id]?.city === activeCity);
  const storeCount: Record<string, number> = {};
  for (const p of cityProducts) storeCount[p.store_id] = (storeCount[p.store_id] ?? 0) + 1;
  const bestStoreId = Object.entries(storeCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const visibleProducts = bestStoreId ? cityProducts.filter((p) => p.store_id === bestStoreId) : [];
  const totalPrice = visibleProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const storeName = visibleProducts.length > 0 ? storeMap[visibleProducts[0].store_id]?.name : undefined;

  function handleAddAll() {
    visibleProducts.forEach((ingredient) => { for (let i = 0; i < ingredient.quantity; i++) addItem(ingredient); });
    setAddedAll(true);
    setAddedIds(new Set(visibleProducts.map((p) => p.id)));
    setTimeout(() => onGoToCart(), 600);
  }

  function handleAddOne(ingredient: RecipeWithProducts["products"][number]) {
    if (addedIds.has(ingredient.id)) {
      removeItem(ingredient.id);
      setAddedIds((prev) => { const s = new Set(prev); s.delete(ingredient.id); return s; });
    } else {
      for (let i = 0; i < ingredient.quantity; i++) addItem(ingredient);
      setAddedIds((prev) => new Set([...prev, ingredient.id]));
    }
  }

  const { style: swipeStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose, threshold: 80, direction: "right" });

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] overflow-hidden">
      <div className="flex flex-col h-full bg-white animate-slide-in-right" style={swipeStyle} {...swipeHandlers}>
      <div className="relative flex flex-col h-full overflow-hidden">
        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 px-4 pb-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <button onClick={onClose} className="mb-3 w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-start gap-4">
            {recipe.image_url && (
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/30">
                <img src={resolveImageUrl(recipe.image_url, "thumb")} alt={recipe.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-xl font-bold text-white leading-tight">{recipe.name}</h2>
              {recipe.description && <p className="text-white/80 text-xs mt-1 leading-relaxed line-clamp-2">{recipe.description}</p>}
              {storeName && <p className="text-white/60 text-[11px] mt-1.5">🏪 {storeName}</p>}
            </div>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 pt-4 pb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ингредиенты · {visibleProducts.length} товаров</p>
          {visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <span className="text-4xl mb-2">🥘</span>
              <p className="text-sm">Ингредиенты не добавлены</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleProducts.map((ingredient) => {
                const isAdded = addedIds.has(ingredient.id);
                return (
                  <div key={ingredient.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-emerald-50/50 transition-colors">
                    <button onClick={() => onOpenProduct(ingredient)} className="w-11 h-11 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center active:scale-95 transition-transform">
                      {ingredient.image_url ? (
                        <img src={resolveImageUrl(ingredient.image_url, "thumb")} alt={ingredient.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-xl">🛍️</span>
                      )}
                    </button>
                    <button onClick={() => onOpenProduct(ingredient)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-gray-900 truncate">{ingredient.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ingredient.price.toLocaleString("ru-RU")} ₽{ingredient.quantity > 1 && <span className="text-gray-400"> · × {ingredient.quantity}</span>}
                      </p>
                    </button>
                    <button onClick={() => handleAddOne(ingredient)} className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${isAdded ? "bg-emerald-100 text-emerald-600" : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"}`}>
                      {isAdded ? (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {visibleProducts.length > 0 && (
          <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Итого за блюдо</p>
              <p className="text-base font-bold text-gray-900">{totalPrice.toLocaleString("ru-RU")} ₽</p>
            </div>
            <button onClick={handleAddAll} className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${addedAll ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500 hover:bg-emerald-600 text-white"}`}>
              {addedAll ? "✓ Всё добавлено!" : "Добавить всё"}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────

function SearchResults({
  q, activeCity, storeMap, onOpenStore, onOpenProduct,
}: {
  q: string;
  activeCity: string;
  storeMap: Record<string, Store>;
  onOpenStore: (storeId: string, productId?: string, categoryId?: string) => void;
  onOpenProduct: (p: Product) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Поиск возвращает первую страницу — для search-результатов на главной
    // обычно достаточно. Полный каталог открывается через "Смотреть все".
    catalogApi.getProducts({ search: q, limit: 50 })
      .then((res) => setProducts(res.data ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [q]);

  const visible = products.filter((p) => storeMap[p.store_id]?.city === activeCity);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-gray-100 rounded-2xl h-52 animate-pulse" />)}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-gray-400">
        <span className="text-5xl mb-3">🔍</span>
        <p className="text-sm">Ничего не найдено</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-500 mb-3">Результаты поиска ({visible.length})</p>
      <div className="grid grid-cols-3 gap-3">
        {visible.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            storeName={storeMap[product.store_id]?.name}
            onOpen={() => onOpenProduct(product)}
            onShowInStore={() => onOpenStore(product.store_id, product.id, product.category_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Home Product Card ────────────────────────────────────────────────────────

function HomeProductCard({
  product, storeName, onOpen, onShowInStore: _onShowInStore, badge,
}: {
  product: Product;
  storeName?: string;
  onOpen: () => void;
  onShowInStore?: () => void;
  badge?: "new" | "hot";
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col active:scale-[0.97] transition-transform cursor-pointer"
      style={{ background: 'var(--bg-surface)' }}
      onClick={onOpen}
    >
      {badge === "new" && (
        <span className="absolute top-2 left-2 z-10 bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none tracking-wide">
          Новинка
        </span>
      )}
      {badge === "hot" && (
        <span className="absolute top-1.5 left-2 z-10 text-base leading-none">🔥</span>
      )}

      <div className="aspect-square bg-gray-50 overflow-hidden">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url, "card")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🛍️</div>
        )}
      </div>
      <div className="p-2 flex flex-col gap-0.5">
        {storeName && (
          <div className="flex items-center gap-1 min-w-0">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
            </svg>
            <p className="text-[10px] text-gray-400 font-medium truncate">{storeName}</p>
          </div>
        )}
        <p className="text-xs font-bold text-gray-900">{product.price.toLocaleString("ru-RU")} ₽</p>
        <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight break-words">{product.name}</p>
      </div>
    </div>
  );
}

// ─── Charity Modal ────────────────────────────────────────────────────────────

function CharityModal({ onClose }: { onClose: () => void }) {
  useBodyScrollLock();
  const { style: swipeStyle, backdropStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onDismiss: onClose });
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9000] bg-black/40 backdrop-blur-sm" onClick={onClose} style={backdropStyle} />
      <div className="fixed inset-0 z-[9001] flex items-end sm:items-center justify-center pointer-events-none">
      <div className="pointer-events-auto relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh]" style={swipeStyle} onClick={(e) => e.stopPropagation()}>
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center py-2.5 flex-shrink-0 touch-none select-none cursor-grab" {...swipeHandlers}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="relative flex-shrink-0 px-6 pt-6 pb-5 text-gray-700 overflow-hidden rounded-t-3xl sm:touch-auto touch-none select-none bg-gray-100 border-b border-gray-200" {...swipeHandlers}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-40 bg-gray-200" />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors z-10">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <div className="relative flex items-center gap-3">
            <span className="text-4xl grayscale opacity-70">🫶</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-0.5">Yuhher Добро · скоро</p>
              <h2 className="text-xl font-bold leading-tight text-gray-800">Делимся теплом</h2>
              <p className="text-xs opacity-75 mt-0.5">Каждый рубль — это чья-то тарелка еды</p>
            </div>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain flex-1 px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">В Чеченской Республике есть люди, которым сейчас тяжело — не хватает самого необходимого. Когда функция запустится, ваши пожертвования пойдут на конкретные покупки в наших магазинах.</p>
          <div className="space-y-2">
            {[
              { icon: "🥖", title: "Еда", desc: "Хлеб, крупы, консервы, молоко" },
              { icon: "🧴", title: "Гигиена", desc: "Мыло, шампунь, зубная паста" },
              { icon: "🧥", title: "Тёплые вещи", desc: "Одежда и одеяла в холода" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <span className="text-2xl flex-shrink-0 grayscale opacity-70">{icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 px-6 pb-6 pt-3 space-y-2 border-t border-gray-100">
          <button disabled className="w-full py-3.5 font-bold rounded-2xl bg-gray-200 text-gray-400 cursor-not-allowed">
            Скоро будет доступно
          </button>
          <p className="text-[11px] text-gray-400 text-center">Готовим запуск — скоро сможете помочь</p>
        </div>
      </div>
      </div>
    </>,
    document.body
  );
}
