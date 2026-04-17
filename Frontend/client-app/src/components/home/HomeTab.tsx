"use client";

import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { catalogApi, resolveImageUrl, type Product, type Store, type RecipeWithProducts } from "@/lib/api";
import { useFavorites } from "@/context/FavoritesContext";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import ProductModal from "@/components/ui/ProductModal";

interface Props {
  onOpenStore: (storeId: string, productId?: string) => void;
  search: string;
  activeCity: string;
}

// ─── Showcase block definitions ──────────────────────────────────────────────

type ShowcaseKey = "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook" | "recipes";

interface ShowcaseBlock {
  key: ShowcaseKey;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  textColor: string;
  size: "full" | "half";
}

const SHOWCASES: ShowcaseBlock[] = [
  {
    key: "new_items",
    title: "Новинки",
    subtitle: "Свежие поступления — первыми попробуй новое",
    emoji: "✨",
    gradient: "from-indigo-500 to-violet-600",
    textColor: "text-white",
    size: "full",
  },
  {
    key: "hits",
    title: "Популярные",
    subtitle: "Хиты продаж, которые все берут",
    emoji: "🔥",
    gradient: "from-orange-400 to-rose-500",
    textColor: "text-white",
    size: "half",
  },
  {
    key: "movie_night",
    title: "Для кино",
    subtitle: "Идеально под фильм",
    emoji: "🍿",
    gradient: "from-purple-600 to-pink-500",
    textColor: "text-white",
    size: "half",
  },
  {
    key: "recipes",
    title: "Рецепты",
    subtitle: "Собери блюдо — добавь все ингредиенты в корзину",
    emoji: "👨‍🍳",
    gradient: "from-emerald-500 to-teal-600",
    textColor: "text-white",
    size: "full",
  },
  {
    key: "quick_snack",
    title: "Быстрый перекус",
    subtitle: "Когда хочется прямо сейчас",
    emoji: "⚡",
    gradient: "from-yellow-400 to-amber-500",
    textColor: "text-white",
    size: "half",
  },
  {
    key: "lazy_cook",
    title: "Лень готовить",
    subtitle: "Готовые решения без усилий",
    emoji: "😴",
    gradient: "from-sky-400 to-blue-600",
    textColor: "text-white",
    size: "half",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeTab({ onOpenStore, search, activeCity }: Props) {
  const [storeMap, setStoreMap] = useState<Record<string, Store>>({});
  const [storesLoading, setStoresLoading] = useState(true);
  const [charityOpen, setCharityOpen] = useState(false);

  const [openShowcase, setOpenShowcase] = useState<ShowcaseKey | null>(null);
  const [showcaseProducts, setShowcaseProducts] = useState<Product[]>([]);
  const [showcaseLoading, setShowcaseLoading] = useState(false);

  const [recipes, setRecipes] = useState<RecipeWithProducts[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [openRecipe, setOpenRecipe] = useState<RecipeWithProducts | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    catalogApi.getStores().then((stores) => {
      const map: Record<string, Store> = {};
      (stores ?? []).forEach((s) => { map[s.id] = s; });
      setStoreMap(map);
    }).catch(() => {}).finally(() => setStoresLoading(false));
  }, []);

  function handleOpenShowcase(key: ShowcaseKey) {
    if (key === "recipes") {
      setOpenShowcase("recipes");
      setRecipesLoading(true);
      catalogApi.getRecipes()
        .then((data) => setRecipes(Array.isArray(data) ? data : []))
        .catch(() => setRecipes([]))
        .finally(() => setRecipesLoading(false));
      return;
    }
    setOpenShowcase(key);
    setShowcaseLoading(true);
    catalogApi.getFeatured(key as "new_items" | "hits" | "movie_night" | "quick_snack" | "lazy_cook")
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

  const activeBlock = SHOWCASES.find((s) => s.key === openShowcase);

  // If search is active, show a flat search result across new_items
  const q = search.trim().toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">

      {/* ── Промо-карусель ── */}
      <PromoBannerCarousel />

      {/* ── Витрина ── */}
      {!q && (
        <div className="space-y-3">
          {/* Row 1: full-width Новинки */}
          <ShowcaseCard block={SHOWCASES[0]} onClick={() => handleOpenShowcase(SHOWCASES[0].key)} />

          {/* Row 2: Популярные + Для кино */}
          <div className="grid grid-cols-2 gap-3">
            <ShowcaseCard block={SHOWCASES[1]} onClick={() => handleOpenShowcase(SHOWCASES[1].key)} compact />
            <ShowcaseCard block={SHOWCASES[2]} onClick={() => handleOpenShowcase(SHOWCASES[2].key)} compact />
          </div>

          {/* Row 3: full-width Рецепты */}
          <ShowcaseCard block={SHOWCASES[3]} onClick={() => handleOpenShowcase(SHOWCASES[3].key)} featured />

          {/* Row 4: Быстрый перекус + Лень готовить */}
          <div className="grid grid-cols-2 gap-3">
            <ShowcaseCard block={SHOWCASES[4]} onClick={() => handleOpenShowcase(SHOWCASES[4].key)} compact />
            <ShowcaseCard block={SHOWCASES[5]} onClick={() => handleOpenShowcase(SHOWCASES[5].key)} compact />
          </div>
        </div>
      )}

      {/* ── Поиск ── */}
      {q && (
        <SearchResults q={q} activeCity={activeCity} storeMap={storeMap} storesLoading={storesLoading} onOpenStore={onOpenStore} onOpenProduct={setSelectedProduct} />
      )}

      {/* ── Блок благотворительности ── */}
      {!q && (
        <button
          onClick={() => setCharityOpen(true)}
          className="w-full text-left rounded-2xl overflow-hidden relative hover:opacity-95 active:scale-[0.98] transition-all"
          style={{ background: "linear-gradient(135deg, #92400e 0%, #b45309 40%, #d97706 100%)" }}
        >
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 bg-white" />
          <div className="relative px-4 py-3 flex items-center gap-3 text-white">
            <span className="text-2xl flex-shrink-0">🫶</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold leading-none">Делимся теплом с теми, кому нужно</p>
                <span className="text-[10px] font-semibold bg-white/20 px-1.5 py-0.5 rounded-full flex-shrink-0">Скоро</span>
              </div>
              <p className="text-[11px] opacity-65 mt-0.5 truncate">Оставь любую сумму — купим продукты нуждающимся</p>
            </div>
            <svg className="w-4 h-4 opacity-50 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
      )}

      {/* ── Модальное окно витрины (товары) ── */}
      {openShowcase && openShowcase !== "recipes" && activeBlock && (
        <ShowcaseModal
          block={activeBlock}
          products={showcaseProducts}
          loading={showcaseLoading}
          storeMap={storeMap}
          activeCity={activeCity}
          onClose={() => { setOpenShowcase(null); setShowcaseProducts([]); }}
          onOpenProduct={setSelectedProduct}
          onOpenStore={onOpenStore}
        />
      )}

      {/* ── Модальное окно рецептов ── */}
      {openShowcase === "recipes" && (
        <RecipesModal
          recipes={recipes}
          loading={recipesLoading}
          storeMap={storeMap}
          activeCity={activeCity}
          onClose={() => { setOpenShowcase(null); setRecipes([]); }}
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
        />
      )}

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

      {charityOpen && <CharityModal onClose={() => setCharityOpen(false)} />}
    </div>
  );
}

// ─── Promo Banner Carousel ────────────────────────────────────────────────────

const WA_LINK = "https://wa.me/79640691596";

const PROMO_BANNERS = [
  {
    id: "cities",
    tag: "Расширяемся",
    headline: "Скоро откроемся\nв вашем городе",
    sub: "Начали с Ойсхара — идём дальше по республике",
    emoji: "🗺️",
    bg: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1e40af 100%)",
    dotColor: "#3b82f6",
    chipColor: "bg-blue-500/20 text-blue-200",
    chips: ["Ойсхар ✓", "Грозный", "Гудермес", "Аргун"],
    modal: {
      title: "Скоро в вашем городе",
      emoji: "🗺️",
      headerBg: "linear-gradient(135deg, #0f172a, #1e40af)",
      body: [
        { icon: "📍", title: "Уже работаем", desc: "Ойсхар — первый город Laman" },
        { icon: "🚀", title: "Следующие города", desc: "Грозный, Гудермес, Аргун и другие города ЧР" },
        { icon: "🔔", title: "Узнайте первыми", desc: "Следите за нами в Instagram — публикуем все новости о запуске" },
      ],
      cta: "Быть в курсе новостей",
      ctaBg: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)",
      ctaAction: "https://instagram.com/LamanDelivery",
      hideCta: false,
    },
  },
  {
    id: "partner",
    tag: "Для бизнеса",
    headline: "Добавь свой\nмагазин в Laman",
    sub: "Тысячи клиентов — без затрат на доставку",
    emoji: "🤝",
    bg: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)",
    dotColor: "#34d399",
    chipColor: "bg-emerald-400/20 text-emerald-200",
    chips: ["Бесплатное подключение", "Своя аналитика", "Поддержка 24/7"],
    modal: {
      title: "Стать партнёром",
      emoji: "🤝",
      headerBg: "linear-gradient(135deg, #064e3b, #059669)",
      body: [
        { icon: "🏪", title: "Любой магазин", desc: "Продукты, аптека, хозтовары, стройматериалы" },
        { icon: "📈", title: "Больше продаж", desc: "Ваш магазин увидят тысячи покупателей" },
        { icon: "💰", title: "Прозрачная комиссия", desc: "Честные условия без скрытых платежей" },
        { icon: "📲", title: "Написать нам", desc: "Ответим в WhatsApp в течение часа" },
      ],
      cta: "Написать в WhatsApp",
      ctaBg: "linear-gradient(135deg, #065f46, #059669)",
      ctaAction: WA_LINK,
      hideCta: false,
    },
  },
  {
    id: "app",
    tag: "Скоро",
    headline: "Laman\nв приложении",
    sub: "App Store и Google Play — уже скоро",
    emoji: "📱",
    bg: "linear-gradient(135deg, #3b0764 0%, #6d28d9 55%, #c026d3 100%)",
    dotColor: "#a78bfa",
    chipColor: "bg-purple-400/20 text-purple-200",
    chips: ["iOS", "Android", "Пуш-уведомления", "Оплата в 1 клик"],
    modal: {
      title: "Приложение Laman",
      emoji: "📱",
      headerBg: "linear-gradient(135deg, #3b0764, #6d28d9)",
      body: [
        { icon: "⚡", title: "Молниеносный заказ", desc: "Сохранённые адреса и корзина за секунду" },
        { icon: "🔔", title: "Push-уведомления", desc: "Статус заказа в реальном времени" },
        { icon: "💳", title: "Быстрая оплата", desc: "Apple Pay, Google Pay, карта одним касанием" },
        { icon: "🎁", title: "Бонусы только для app", desc: "Эксклюзивные скидки для пользователей приложения" },
      ],
      cta: "",
      ctaBg: "",
      ctaAction: "",
      hideCta: true,
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
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % PROMO_BANNERS.length);
    }, 6_000);
  }

  useEffect(() => {
    startInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  function go(dir: 1 | -1) {
    setIndex((i) => (i + dir + PROMO_BANNERS.length) % PROMO_BANNERS.length);
    startInterval();
  }

  function handleDot(i: number) {
    setIndex(i);
    startInterval();
  }

  function handleOpen(banner: PromoBannerType) {
    if (didSwipe.current) return;
    setOpenBanner(banner);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  function handleClose() {
    setOpenBanner(null);
    startInterval();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      didSwipe.current = true;
      go(delta < 0 ? 1 : -1);
    }
    touchStartX.current = null;
  }

  const banner = PROMO_BANNERS[index];

  return (
    <>
      <div
        className="select-none rounded-2xl overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Slide track */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {PROMO_BANNERS.map((b, i) => (
            <button
              key={b.id}
              onClick={() => handleOpen(b)}
              className="relative w-full flex-shrink-0 text-left overflow-hidden"
              style={{ background: b.bg }}
            >
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
              <div className="absolute -bottom-6 right-12 w-28 h-28 rounded-full bg-white/5" />
              <div className="absolute top-3 -left-4 w-16 h-16 rounded-full bg-white/5" />

              <div className="relative px-5 pt-5 pb-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                    {b.tag}
                  </span>
                  <h2 className="text-[18px] font-extrabold text-white leading-snug whitespace-pre-line">
                    {b.headline}
                  </h2>
                  <p className="text-white/60 text-[11px] mt-1.5 leading-relaxed">{b.sub}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {b.chips.slice(0, 3).map((chip) => (
                      <span key={chip} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.chipColor}`}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-1">
                  <span className="text-[44px] leading-none">{b.emoji}</span>
                  <span className="text-white/40 text-[10px] font-medium flex items-center gap-0.5">
                    Подробнее
                    <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Controls bar — below slides, never overlaps */}
        <div className="flex items-center justify-between px-3 py-2" style={{ background: PROMO_BANNERS[index].bg }}>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="flex gap-2">
            {PROMO_BANNERS.map((_, i) => (
              <button
                key={i}
                onClick={() => handleDot(i)}
                className="transition-all duration-300"
                style={{
                  width: i === index ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === index ? banner.dotColor : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {openBanner && <PromoModal banner={openBanner} onClose={handleClose} />}
    </>
  );
}

function PromoModal({ banner, onClose }: { banner: PromoBannerType; onClose: () => void }) {
  useBodyScrollLock();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-7 pb-6 text-white overflow-hidden" style={{ background: banner.modal.headerBg }}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative">
            <span className="text-5xl">{banner.modal.emoji}</span>
            <h2 className="text-2xl font-extrabold mt-3 leading-tight">{banner.modal.title}</h2>
          </div>
        </div>

        {/* Body */}
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

        {/* CTA */}
        <div className="px-5 pb-6">
          {banner.modal.hideCta ? (
            <p className="text-center text-xs text-gray-400 leading-relaxed">
              🔔 Скоро сообщим, когда приложение будет готово
            </p>
          ) : (
            <button
              onClick={() => window.open(banner.modal.ctaAction, "_blank", "noopener")}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all active:scale-[0.98]"
              style={{ background: banner.modal.ctaBg }}
            >
              {banner.modal.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Showcase Card ────────────────────────────────────────────────────────────

function ShowcaseCard({
  block,
  onClick,
  compact = false,
  featured = false,
}: {
  block: ShowcaseBlock;
  onClick: () => void;
  compact?: boolean;
  featured?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl overflow-hidden relative group active:scale-[0.98] transition-all duration-150 bg-gradient-to-br ${block.gradient} ${
        featured ? "min-h-[140px]" : compact ? "min-h-[110px]" : "min-h-[130px]"
      }`}
    >
      {/* Декоративный круг */}
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/10" />

      <div className="relative p-4 flex flex-col h-full justify-between">
        <div>
          <span className={`${compact ? "text-3xl" : featured ? "text-5xl" : "text-4xl"}`}>{block.emoji}</span>
          <h3 className={`text-white font-bold mt-2 leading-tight ${compact ? "text-sm" : featured ? "text-xl" : "text-base"}`}>
            {block.title}
          </h3>
          {!compact && (
            <p className={`text-white/75 text-xs mt-1 leading-relaxed ${featured ? "max-w-[260px]" : "max-w-[200px]"}`}>
              {block.subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 mt-3">
          <span className="text-white/90 text-xs font-semibold">Смотреть</span>
          <svg className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ─── Showcase Modal (product grid) ───────────────────────────────────────────

function ShowcaseModal({
  block,
  products,
  loading,
  storeMap,
  activeCity,
  onClose,
  onOpenProduct,
  onOpenStore,
}: {
  block: ShowcaseBlock;
  products: Product[];
  loading: boolean;
  storeMap: Record<string, Store>;
  activeCity: string;
  onClose: () => void;
  onOpenProduct: (p: Product) => void;
  onOpenStore: (storeId: string, productId?: string) => void;
}) {
  useBodyScrollLock();

  const visibleProducts = products.filter((p) => storeMap[p.store_id]?.city === activeCity);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-hidden" onClick={onClose}>
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] min-h-[80dvh] sm:min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${block.gradient} px-5 pt-5 pb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{block.emoji}</span>
              <div>
                <h2 className="text-lg font-bold text-white">{block.title}</h2>
                <p className="text-white/75 text-xs">{block.subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-4 bg-gray-50">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-52 animate-pulse" />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <span className="text-5xl mb-3">🛍️</span>
              <p className="text-sm">Товары скоро появятся</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleProducts.map((product) => (
                <HomeProductCard
                  key={product.id}
                  product={product}
                  storeName={storeMap[product.store_id]?.name}
                  onOpen={() => onOpenProduct(product)}
                  onShowInStore={() => { onClose(); onOpenStore(product.store_id, product.id); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Recipes Modal ────────────────────────────────────────────────────────────

function RecipesModal({
  recipes,
  loading,
  storeMap,
  activeCity,
  onClose,
  onOpenRecipe,
  recipeLoading,
}: {
  recipes: RecipeWithProducts[];
  loading: boolean;
  storeMap: Record<string, Store>;
  activeCity: string;
  onClose: () => void;
  onOpenRecipe: (id: string) => void;
  recipeLoading: boolean;
}) {
  useBodyScrollLock();

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-hidden" onClick={onClose}>
      <div
        className="relative bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] min-h-[80dvh] sm:min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">👨‍🍳</span>
              <div>
                <h2 className="text-lg font-bold text-white">Рецепты</h2>
                <p className="text-white/75 text-xs">Выбери блюдо и собери ингредиенты</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* Recipe cards grid */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-4 bg-gray-50">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-52 animate-pulse" />
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <span className="text-5xl mb-3">📋</span>
              <p className="text-sm">Рецепты скоро появятся</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => onOpenRecipe(recipe.id)}
                  disabled={recipeLoading}
                  className="text-left bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 flex flex-col"
                >
                  {/* Recipe image */}
                  <div className="aspect-square w-full bg-gray-50 overflow-hidden flex items-center justify-center">
                    {recipe.image_url ? (
                      <img src={resolveImageUrl(recipe.image_url)} alt={recipe.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">🍽️</span>
                    )}
                  </div>
                  {/* Recipe info */}
                  <div className="p-3 flex flex-col flex-1 gap-1">
                    <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{recipe.name}</p>
                    {recipe.description && (
                      <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{recipe.description}</p>
                    )}
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
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Recipe Detail Modal ──────────────────────────────────────────────────────

function RecipeDetailModal({
  recipe,
  storeMap,
  activeCity,
  onClose,
  onOpenProduct,
}: {
  recipe: RecipeWithProducts;
  storeMap: Record<string, Store>;
  activeCity: string;
  onClose: () => void;
  onOpenProduct: (p: Product) => void;
}) {
  const { addItem } = useCart();
  const [addedAll, setAddedAll] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useBodyScrollLock();

  // Filter by city, then pick the store with the most ingredients
  const cityProducts = recipe.products.filter(
    (p) => storeMap[p.store_id]?.city === activeCity
  );
  const storeCount: Record<string, number> = {};
  for (const p of cityProducts) storeCount[p.store_id] = (storeCount[p.store_id] ?? 0) + 1;
  const bestStoreId = Object.entries(storeCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const visibleProducts = bestStoreId ? cityProducts.filter((p) => p.store_id === bestStoreId) : [];

  function handleAddAll() {
    visibleProducts.forEach((ingredient) => {
      for (let i = 0; i < ingredient.quantity; i++) {
        addItem(ingredient);
      }
    });
    setAddedAll(true);
    setAddedIds(new Set(visibleProducts.map((p) => p.id)));
    setTimeout(() => setAddedAll(false), 2500);
  }

  function handleAddOne(ingredient: RecipeWithProducts["products"][number]) {
    for (let i = 0; i < ingredient.quantity; i++) {
      addItem(ingredient);
    }
    setAddedIds((prev) => new Set([...prev, ingredient.id]));
  }

  const totalPrice = visibleProducts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const storeName = visibleProducts.length > 0 ? storeMap[visibleProducts[0].store_id]?.name : undefined;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-hidden" onClick={onClose}>
      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] min-h-[80dvh] sm:min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 px-5 pt-5 pb-5">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <div className="flex items-start gap-4">
            {recipe.image_url && (
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/30">
                <img src={resolveImageUrl(recipe.image_url)} alt={recipe.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-xl font-bold text-white leading-tight">{recipe.name}</h2>
              {recipe.description && (
                <p className="text-white/80 text-xs mt-1 leading-relaxed line-clamp-2">{recipe.description}</p>
              )}
              {storeName && (
                <p className="text-white/60 text-[11px] mt-1.5">🏪 {storeName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Ingredients list */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 pt-4 pb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Ингредиенты · {visibleProducts.length} товаров
          </p>
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
                    {/* Thumbnail — click opens product */}
                    <button
                      onClick={() => onOpenProduct(ingredient)}
                      className="w-11 h-11 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center active:scale-95 transition-transform"
                    >
                      {ingredient.image_url ? (
                        <img src={resolveImageUrl(ingredient.image_url)} alt={ingredient.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🛍️</span>
                      )}
                    </button>

                    {/* Name + price — click opens product */}
                    <button
                      onClick={() => onOpenProduct(ingredient)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">{ingredient.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {ingredient.price.toLocaleString("ru-RU")} ₽
                        {ingredient.quantity > 1 && <span className="text-gray-400"> · × {ingredient.quantity}</span>}
                      </p>
                    </button>

                    {/* Add to cart button */}
                    <button
                      onClick={() => handleAddOne(ingredient)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                        isAdded
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                      }`}
                    >
                      {isAdded ? (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {visibleProducts.length > 0 && (
          <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Итого за блюдо</p>
              <p className="text-base font-bold text-gray-900">{totalPrice.toLocaleString("ru-RU")} ₽</p>
            </div>
            <button
              onClick={handleAddAll}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
                addedAll
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              {addedAll ? "✓ Всё добавлено!" : "Добавить всё"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────

function SearchResults({
  q,
  activeCity,
  storeMap,
  storesLoading,
  onOpenStore,
  onOpenProduct,
}: {
  q: string;
  activeCity: string;
  storeMap: Record<string, Store>;
  storesLoading: boolean;
  onOpenStore: (storeId: string, productId?: string) => void;
  onOpenProduct: (p: Product) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    catalogApi.getFeatured("new_items")
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const cityProducts = products.filter((p) => storeMap[p.store_id]?.city === activeCity);
  const visible = cityProducts.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
  );

  if (loading || storesLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-52 animate-pulse" />
        ))}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map((product) => (
          <HomeProductCard
            key={product.id}
            product={product}
            storeName={storeMap[product.store_id]?.name}
            onOpen={() => onOpenProduct(product)}
            onShowInStore={() => onOpenStore(product.store_id, product.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Home Product Card ────────────────────────────────────────────────────────

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

// ─── Charity Modal ────────────────────────────────────────────────────────────

function CharityModal({ onClose }: { onClose: () => void }) {
  useBodyScrollLock();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — фиксированный, кнопка закрытия всегда видна */}
        <div
          className="relative flex-shrink-0 px-6 pt-6 pb-5 text-white overflow-hidden rounded-t-3xl"
          style={{ background: "linear-gradient(135deg, #92400e 0%, #b45309 40%, #d97706 100%)" }}
        >
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-white" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors z-10"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative flex items-center gap-3">
            <span className="text-4xl">🫶</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-0.5">Laman Добро</p>
              <h2 className="text-xl font-bold leading-tight">Делимся теплом</h2>
              <p className="text-xs opacity-75 mt-0.5">Каждый рубль — это чья-то тарелка еды</p>
            </div>
          </div>
        </div>

        {/* Тело — скроллится если не помещается */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            В Грозном, как и в любом городе, есть люди, которым сейчас тяжело. Пожилые, многодетные семьи, те, кто оказался в сложной ситуации — им не хватает самого необходимого.
          </p>
          <div className="space-y-2">
            {[
              { icon: "🥖", title: "Еда", desc: "Хлеб, крупы, консервы, молоко" },
              { icon: "🧴", title: "Гигиена", desc: "Мыло, шампунь, зубная паста" },
              { icon: "🧥", title: "Тёплые вещи", desc: "Одежда и одеяла в холода" },
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
        </div>

        {/* Футер — фиксированный снизу */}
        <div className="flex-shrink-0 px-6 pb-6 pt-3 space-y-2 border-t border-amber-50">
          <button
            onClick={onClose}
            className="w-full py-3.5 font-bold rounded-2xl transition-all active:scale-[0.98] text-white"
            style={{ background: "linear-gradient(135deg, #b45309, #d97706)" }}
          >
            Буду рад помочь ❤️
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Функция пожертвования появится совсем скоро
          </p>
        </div>
      </div>
    </div>
  );
}
