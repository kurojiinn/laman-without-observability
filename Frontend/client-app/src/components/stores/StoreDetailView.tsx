"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { adminApi, catalogApi, reviewsApi, isStoreOpen, resolveImageUrl, type Store, type Product, type Review, type CategoryNode } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import ProductModal from "@/components/ui/ProductModal";
import { useFavorites } from "@/context/FavoritesContext";
import { CATEGORY_META, DEFAULT_META } from "@/components/ui/CategoryIcon";
import StoreAvatar from "@/components/ui/StoreAvatar";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";

// Re-export for backward compatibility (StoresTab, CategoriesTab импортируют отсюда)
export { CATEGORY_META as STORE_CATEGORY_META };

const SORT_OPTIONS = [
  { label: "По умолчанию", value: "" },
  { label: "Дешевле", value: "price_asc" },
  { label: "Дороже", value: "price_desc" },
  { label: "Новые", value: "newest" },
];

const PAGE_SIZE = 20;

export default function StoreDetailView({
  store: initialStore,
  onBack,
  targetProductId,
  search = "",
  sort: sortProp,
  onSortChange,
  isAdmin = false,
  disableSwipe = false,
}: {
  store: Store;
  onBack: () => void;
  targetProductId?: string;
  search?: string;
  sort?: string;
  onSortChange?: (v: string) => void;
  isAdmin?: boolean;
  disableSwipe?: boolean;
}) {
  const [store, setStore] = useState<Store>(initialStore);
  const meta = CATEGORY_META[store.category_type ?? ""] ?? DEFAULT_META;

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "reviews">("products");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Двухуровневый фильтр: ряд 1 — главные категории, ряд 2 — подкатегории
  // выбранной главной категории. По умолчанию выбрана первая категория —
  // отдельного пункта «Все товары» нет, чтобы не грузить весь каталог сразу.
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [categoryReady, setCategoryReady] = useState(false); // дерево загружено (или пустое)
  const [selectedL1, setSelectedL1] = useState<CategoryNode | null>(null);
  const [selectedL2Id, setSelectedL2Id] = useState<string | null>(null);   // null = все подкатегории L1
  const [localSort, setLocalSort] = useState("");
  const sort = sortProp !== undefined ? sortProp : localSort;
  const handleSortChange = onSortChange ?? setLocalSort;
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { items: cartItems, addItem } = useCart();
  const { isAuthenticated, user } = useAuth();
  const effectiveIsAdmin = isAdmin || user?.role === "ADMIN";

  // Admin store edit state
  const [storeEditOpen, setStoreEditOpen] = useState(false);
  const [editStoreName, setEditStoreName] = useState(store.name);
  const [editStoreAddress, setEditStoreAddress] = useState(store.address);
  const [editStoreDesc, setEditStoreDesc] = useState(store.description ?? "");
  const [editStoreOpens, setEditStoreOpens] = useState(store.opens_at ?? "");
  const [editStoreCloses, setEditStoreCloses] = useState(store.closes_at ?? "");
  const [savingStore, setSavingStore] = useState(false);
  const [storeEditError, setStoreEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!sortOpen) return;
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sortOpen]);

  // Загружаем дерево категорий магазина. По умолчанию выбираем первую категорию.
  useEffect(() => {
    setCategoryTree([]);
    setCategoryReady(false);
    setSelectedL1(null);
    setSelectedL2Id(null);
    catalogApi.getStoreCategoryTree(store.id)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCategoryTree(list);
        setSelectedL1(list[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setCategoryReady(true));
  }, [store.id]);

  // Параметр фильтра товаров из выбранной категории. Поиск переопределяет фильтр.
  // Бэкенд по subcategory_id сам разворачивает категорию верхнего уровня в её
  // дочерние подкатегории, поэтому достаточно передать id выбранного узла.
  const filterParams = useMemo<{ subcategory_id?: string }>(() => {
    if (search) return {};
    if (!selectedL1) return {};                                // нет категорий у магазина
    if (selectedL2Id) return { subcategory_id: selectedL2Id };  // конкретная подкатегория
    return { subcategory_id: selectedL1.id };                  // категория целиком
  }, [search, selectedL1, selectedL2Id]);

  // Первая загрузка / смена фильтра / смена поиска.
  // Ждём загрузки дерева категорий, чтобы не подтянуть весь каталог до выбора
  // категории по умолчанию.
  useEffect(() => {
    if (!categoryReady) return;
    setProducts([]);
    setHasMore(true);
    offsetRef.current = 0;
    setProductsLoading(true);

    catalogApi
      .getStoreProducts(store.id, {
        ...filterParams,
        search: search || undefined,
        sort: sort || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      })
      .then((res) => {
        setProducts(res.data);
        offsetRef.current = res.data.length;
        setHasMore(res.has_more);
      })
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [store.id, categoryReady, filterParams, search, sort]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    catalogApi
      .getStoreProducts(store.id, {
        ...filterParams,
        search: search || undefined,
        sort: sort || undefined,
        limit: PAGE_SIZE,
        offset: offsetRef.current,
      })
      .then((res) => {
        setProducts((prev) => [...prev, ...res.data]);
        offsetRef.current += res.data.length;
        setHasMore(res.has_more);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [store.id, filterParams, search, sort, loadingMore, hasMore]);

  // IntersectionObserver — следит за sentinel-div внизу списка
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    reviewsApi.getByStore(store.id)
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]));
  }, [store.id]);

  // Скроллим к целевому товару после загрузки
  useEffect(() => {
    if (!targetProductId || productsLoading || products.length === 0) return;
    const el = document.getElementById(`product-${targetProductId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    }
  }, [targetProductId, productsLoading, products]);

  async function handleSaveStore() {
    setSavingStore(true);
    setStoreEditError(null);
    try {
      const updated = await adminApi.updateStore(store.id, {
        name: editStoreName.trim(),
        address: editStoreAddress.trim(),
        description: editStoreDesc.trim() || undefined,
        opens_at: editStoreOpens || undefined,
        closes_at: editStoreCloses || undefined,
      });
      setStore(updated);
      setStoreEditOpen(false);
    } catch (err) {
      setStoreEditError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingStore(false);
    }
  }

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : store.rating;

  const storeOpen = isStoreOpen(store);

  const { style: swipeStyle, handlers: swipeHandlers } = useSwipeToDismiss({
    onDismiss: onBack,
    direction: "right",
    threshold: 80,
  });

  const swipeProps = disableSwipe ? {} : { style: swipeStyle, ...swipeHandlers };

  return (
    <div className="overflow-x-hidden">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6" {...swipeProps}>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-5"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Назад
      </button>

      {/* Admin: store edit button */}
      {effectiveIsAdmin && (
        <button
          onClick={() => { setStoreEditOpen(true); setEditStoreName(store.name); setEditStoreAddress(store.address); setEditStoreDesc(store.description ?? ""); setEditStoreOpens(store.opens_at ?? ""); setEditStoreCloses(store.closes_at ?? ""); }}
          className="mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-semibold rounded-xl transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Редактировать магазин
        </button>
      )}

      {/* Шапка магазина */}
      <div className={`relative bg-white rounded-2xl border p-6 mb-5 overflow-hidden ${storeOpen ? "border-gray-100" : "border-gray-200"}`}>
        {/* Затухший оверлей когда магазин закрыт */}
        {!storeOpen && (
          <div className="absolute inset-0 bg-gray-100/60 z-10 pointer-events-none rounded-2xl" />
        )}
        <div className="flex items-start gap-3 sm:gap-4">
          <StoreAvatar store={store} className="w-16 h-16 rounded-2xl" textClass="text-xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{store.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{store.address}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-1 rounded-full flex-shrink-0 max-w-[100px] text-center leading-tight ${meta.badgeClass}`}>
                {meta.label}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg
                      key={s}
                      className={`w-4 h-4 ${s <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-200"}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {avgRating > 0 ? avgRating.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">({reviews.length} отзывов)</span>
              </div>

              {/* Часы работы */}
              {store.opens_at && store.closes_at ? (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  storeOpen
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {storeOpen ? "Открыто" : "Закрыто"} · {store.opens_at}–{store.closes_at}
                </div>
              ) : null}
            </div>

            {store.description && (
              <p className="text-sm text-gray-500 mt-2">{store.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex items-center border-b border-gray-200 mb-5 gap-6">
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "products"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Товары
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "reviews"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Отзывы
        </button>

        {/* Фильтр сортировки */}
        {activeTab === "products" && (
          <div className="relative ml-auto pb-2" ref={sortRef}>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                sort ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M3 5h14M6 10h8M9 15h2" />
              </svg>
              {sort ? SORT_OPTIONS.find(o => o.value === sort)?.label : "Сортировка"}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-9 w-44 rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-50 bg-white">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      sort === opt.value ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => { handleSortChange(opt.value); setSortOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === "products" && (
        <>
          {/* Двухуровневый фильтр категорий. data-no-swipe — чтобы горизонтальный
              скролл не воспринимался как свайп-выход из магазина. */}
          {categoryTree.length > 0 && (
            <div className="mb-5">
              {/* ── Категории — крупные карточки-навигация ── */}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">
                Категории
              </p>
              <div data-no-swipe className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                {categoryTree.map((node) => (
                  <CategoryCard
                    key={node.id}
                    label={node.name}
                    active={selectedL1?.id === node.id}
                    onClick={() => { setSelectedL1(node); setSelectedL2Id(null); }}
                  />
                ))}
              </div>

              {/* ── Подкатегории — компактные фильтр-пилюли. Появляются плавно
                  сверху вниз через max-height. Категория без детей — блок скрыт. ── */}
              <div
                className={`overflow-hidden transition-[max-height] duration-300 ease-out ${
                  selectedL1 && selectedL1.children.length > 0 ? "max-h-32" : "max-h-0"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mt-5 mb-2.5">
                  Подкатегории
                </p>
                <div data-no-swipe className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                  <CategoryChip
                    label="Все"
                    active={selectedL2Id === null}
                    onClick={() => setSelectedL2Id(null)}
                  />
                  {selectedL1?.children.map((child) => (
                    <CategoryChip
                      key={child.id}
                      label={child.name}
                      active={selectedL2Id === child.id}
                      onClick={() => setSelectedL2Id(child.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {productsLoading ? (
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-44 animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-5xl mb-4">📦</span>
              <p className="text-sm">Товары пока не добавлены</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
                {products.map((product) => {
                  const cartItem = cartItems.find((i) => i.product.id === product.id);
                  return (
                    <StoreProductCard
                      key={product.id}
                      product={product}
                      cartQty={cartItem?.quantity ?? 0}
                      onAdd={() => addItem(product)}
                      onOpen={() => setSelectedProduct(product)}
                      isTarget={product.id === targetProductId}
                      storeOpen={storeOpen}
                      isAdmin={effectiveIsAdmin}
                    />
                  );
                })}
              </div>
              {/* Sentinel для infinite scroll */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-gray-100 rounded-2xl h-44 animate-pulse" />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === "reviews" && (
        <ReviewsSection
          storeId={store.id}
          reviews={reviews}
          isAuthenticated={isAuthenticated}
          isAdmin={effectiveIsAdmin}
          currentUserId={user?.id}
          onReviewAdded={(r) => setReviews((prev) => [r, ...prev])}
          onReviewDeleted={(id) => setReviews((prev) => prev.filter((r) => r.id !== id))}
        />
      )}

      {/* Admin store edit modal */}
      {storeEditOpen && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/50" onClick={() => setStoreEditOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-[9999] flex items-end sm:items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">Редактировать магазин</h3>
                <button onClick={() => setStoreEditOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Название</label>
                  <input value={editStoreName} onChange={(e) => setEditStoreName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" style={{ fontSize: 16 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Адрес</label>
                  <input value={editStoreAddress} onChange={(e) => setEditStoreAddress(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" style={{ fontSize: 16 }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Описание</label>
                  <textarea value={editStoreDesc} onChange={(e) => setEditStoreDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none" style={{ fontSize: 16 }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Открытие</label>
                    <input type="time" value={editStoreOpens} onChange={(e) => setEditStoreOpens(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" style={{ fontSize: 16 }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Закрытие</label>
                    <input type="time" value={editStoreCloses} onChange={(e) => setEditStoreCloses(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" style={{ fontSize: 16 }} />
                  </div>
                </div>
                {storeEditError && <p className="text-xs text-red-500">{storeEditError}</p>}
                <div className="flex gap-2 pt-1 pb-2">
                  <button onClick={() => setStoreEditOpen(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-2xl hover:bg-gray-50 transition-colors">Отмена</button>
                  <button onClick={handleSaveStore} disabled={savingStore} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-2xl transition-colors">
                    {savingStore ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          storeName={store.name}
          onClose={() => setSelectedProduct(null)}
          onProductUpdated={(updated) => setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p))}
        />
      )}
    </div>
    </div>
  );
}

// ─── Category Chip ─────────────────────────────────────────────────────────────
// Чип фильтра категорий. Цвета заданы по ТЗ (вне палитры Tailwind) — inline-стилями.
// level 1 — главные категории, level 2 — подкатегории (чуть меньше).

// CategoryCard — L1 «категория»: крупная карточка-навигация. Glassmorphism в
// неактивном состоянии, фиолетовый неон-градиент с свечением в активном.
function CategoryCard({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-[92px] h-[92px] rounded-3xl flex flex-col items-center justify-center gap-1.5 px-2 transition-all duration-200 active:scale-[0.96] ${
        active
          ? "bg-gradient-to-br from-[#7C3AED] to-[#4B5EFC] border border-[#9B7CFF]/60 shadow-[0_0_24px_rgba(124,77,255,0.55)]"
          : "bg-white/[0.04] border border-white/10 backdrop-blur-md hover:bg-white/[0.07]"
      }`}
    >
      <span className={`w-7 h-7 ${active ? "text-white" : "text-[#9B8CFF]"}`}>
        {categoryGlyph(label)}
      </span>
      <span
        className={`text-[11px] font-semibold leading-tight text-center line-clamp-2 ${
          active ? "text-white" : "text-gray-300"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

// CategoryChip — L2 «подкатегория»: компактная фильтр-пилюля. Залитый
// фиолетовый с мягким свечением в активном, тёмная стеклянная в неактивном.
function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-[#7C3AED] text-white shadow-[0_0_16px_rgba(124,77,255,0.45)]"
          : "bg-white/[0.04] text-gray-400 border border-white/10 hover:bg-white/[0.07]"
      }`}
    >
      {label}
    </button>
  );
}

// Минимальная линейная иконка для категории по ключевому слову в названии.
// Категории динамические (приходят из API) — фиксированного маппинга нет,
// поэтому матчим по подстроке, с аккуратным фоллбэком-ярлыком.
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full"
    >
      {children}
    </svg>
  );
}

function categoryGlyph(name: string) {
  const n = name.toLowerCase();
  if (/молоч|сыр|яйц|творог/.test(n))
    return <Glyph><path d="M8 2h8M9 2v3.5L6 9v11a2 2 0 002 2h8a2 2 0 002-2V9l-3-3.5V2" /></Glyph>;
  if (/овощ|фрукт|зелен|ягод/.test(n))
    return <Glyph><path d="M12 11a6 6 0 016 6 6 6 0 01-12 0 6 6 0 016-6z" /><path d="M12 11V6a4 4 0 014-4" /></Glyph>;
  if (/мяс|колбас|птиц|рыб|курин/.test(n))
    return <Glyph><path d="M15 3a6 6 0 016 6c0 4-3 6-6 7l-5 4a3 3 0 11-4-4l4-5c1-3 3-6 7-6z" /></Glyph>;
  if (/напит|вода|сок|чай|кофе|лимонад/.test(n))
    return <Glyph><path d="M6 3h12l-1 16a2 2 0 01-2 2H9a2 2 0 01-2-2L6 3z" /><path d="M6.5 9h11" /></Glyph>;
  if (/хлеб|выпеч|бул|батон/.test(n))
    return <Glyph><path d="M4 11a4 4 0 014-4h8a4 4 0 014 4c0 1.2-1 2-2 2v5a1 1 0 01-1 1H7a1 1 0 01-1-1v-5c-1 0-2-.8-2-2z" /></Glyph>;
  if (/сладк|конд|десерт|шоколад|конфет/.test(n))
    return <Glyph><path d="M12 21C7 17 4 14 4 10a4 4 0 018-1 4 4 0 018 1c0 4-3 7-8 11z" /></Glyph>;
  if (/быт|хим|чист|гигиен|уборк/.test(n))
    return <Glyph><path d="M9 3h6v4l2 3v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9l2-3V3z" /><path d="M7 13h10" /></Glyph>;
  if (/дет|игруш|малыш/.test(n))
    return <Glyph><circle cx="12" cy="7" r="3" /><path d="M5 21v-2a7 7 0 0114 0v2" /></Glyph>;
  if (/зам|морож/.test(n))
    return <Glyph><path d="M12 2v20M4 7l16 10M20 7L4 17" /></Glyph>;
  if (/бакал|круп|макарон|мук/.test(n))
    return <Glyph><path d="M6 8h12l-1.5 12a1 1 0 01-1 1H8.5a1 1 0 01-1-1L6 8z" /><path d="M9 8V5a3 3 0 016 0v3" /></Glyph>;
  return <Glyph><path d="M3 12V5a2 2 0 012-2h7l9 9-9 9-9-9z" /><circle cx="7.5" cy="7.5" r="1.5" /></Glyph>;
}

// ─── Store Product Card ────────────────────────────────────────────────────────

function StoreProductCard({
  product,
  cartQty,
  onAdd,
  onOpen,
  isTarget,
  storeOpen = true,
  isAdmin = false,
}: {
  product: Product;
  cartQty: number;
  onAdd: () => void;
  onOpen: () => void;
  isTarget?: boolean;
  storeOpen?: boolean;
  isAdmin?: boolean;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isAuthenticated, openAuthModal } = useAuth();
  const fav = isFavorite(product.id);
  const [highlighted, setHighlighted] = useState(!!isTarget);

  useEffect(() => {
    if (!isTarget) return;
    setHighlighted(true);
    const t = setTimeout(() => setHighlighted(false), 2000);
    return () => clearTimeout(t);
  }, [isTarget]);

  function handleFav(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isAuthenticated) { openAuthModal(); return; }
    toggleFavorite(product);
  }

  return (
    <div
      id={`product-${product.id}`}
      className={`relative bg-white rounded-2xl p-3 flex flex-col gap-2 cursor-pointer hover:shadow-md transition-all duration-700 ${
        highlighted
          ? "border-2 border-indigo-500 shadow-md shadow-indigo-100"
          : "border border-gray-100"
      }`}
      onClick={onOpen}
    >
      {!isAdmin && (
        <button
          onClick={handleFav}
          className="absolute top-3 right-3 z-10 w-7 h-7 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={fav ? "#ef4444" : "none"} stroke={fav ? "#ef4444" : "#9ca3af"} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      )}
      <div className="w-full h-28 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url, "card")} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-3xl">🛍️</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight break-words">{product.name}</p>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-sm font-bold text-gray-900 truncate">
          {product.price.toLocaleString("ru-RU")} ₽
        </span>
        {isAdmin ? (
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            title="Редактировать товар"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-500"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); if (storeOpen) onAdd(); }}
            disabled={!storeOpen}
            title={!storeOpen ? "Магазин закрыт" : undefined}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
              storeOpen
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      {!isAdmin && cartQty > 0 && (
        <p className="text-xs text-indigo-500 font-medium">В корзине: {cartQty} шт.</p>
      )}
    </div>
  );
}

// ─── Reviews Section ──────────────────────────────────────────────────────────

function ReviewsSection({
  storeId,
  reviews,
  isAuthenticated,
  isAdmin = false,
  currentUserId,
  onReviewAdded,
  onReviewDeleted,
}: {
  storeId: string;
  reviews: Review[];
  isAuthenticated: boolean;
  isAdmin?: boolean;
  currentUserId?: string;
  onReviewAdded: (r: Review) => void;
  onReviewDeleted: (id: string) => void;
}) {
  const [canReview, setCanReview] = useState<boolean | null>(null);
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setCanReview(false); return; }
    reviewsApi.canReview(storeId)
      .then((res) => setCanReview(res.can_review))
      .catch(() => setCanReview(false));
  }, [storeId, isAuthenticated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const review = await reviewsApi.add(storeId, rating, comment.trim());
      onReviewAdded(review);
      setComment("");
      setRating(5);
      // canReview гасим оптимистично — backend всё равно отдаст false на следующий запрос
      setCanReview(false);
      toast.success("Спасибо за отзыв!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось отправить отзыв";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function renderForm() {
    if (canReview === null) {
      // загрузка
      return <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />;
    }

    if (canReview === false) {
      return (
        <div className="flex flex-col items-center py-6 gap-2 text-center">
          <span className="text-2xl">🛍️</span>
          <p className="text-sm text-gray-500">
            Оставить отзыв могут только те, кто делал заказ из этого магазина
          </p>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Оценка</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(s)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <svg
                  className={`w-8 h-8 transition-colors ${
                    s <= (hovered || rating) ? "text-yellow-400" : "text-gray-200"
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
            <span className="ml-2 self-center text-sm text-gray-500">
              {["", "Плохо", "Так себе", "Нормально", "Хорошо", "Отлично"][hovered || rating]}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Комментарий</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Расскажите о своём опыте..."
            rows={3}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
          />
        </div>

        {submitError && <p className="text-xs text-red-500">{submitError}</p>}

        <button
          type="submit"
          disabled={!comment.trim() || submitting}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {submitting ? "Отправка..." : "Отправить отзыв"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reviews list — visible to everyone */}
      {reviews.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-5xl mb-3">💬</span>
          <p className="text-sm">Отзывов пока нет. Будьте первым!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              storeId={storeId}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onDelete={onReviewDeleted}
              onRollback={onReviewAdded}
            />
          ))}
        </div>
      )}

      {/* Add review — only for authenticated users */}
      {isAuthenticated && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Оставить отзыв</h3>
          {renderForm()}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  storeId,
  isAdmin = false,
  currentUserId,
  onDelete,
  onRollback,
}: {
  review: Review;
  storeId: string;
  isAdmin?: boolean;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onRollback?: (r: Review) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const date = new Date(review.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

  const isOwner = !!currentUserId && review.user_id === currentUserId;

  async function handleDelete() {
    setDeleting(true);
    // Optimistic: убираем отзыв из списка сразу, на ошибке восстанавливаем.
    onDelete(review.id);
    try {
      if (isAdmin) {
        await adminApi.deleteReview(storeId, review.id);
      } else {
        await reviewsApi.deleteOwn(storeId, review.id);
      }
      toast.success("Отзыв удалён");
    } catch {
      onRollback?.(review);
      toast.error("Не удалось удалить отзыв");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-indigo-600">
              {review.user_phone.slice(-2)}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900">
              +{review.user_phone.slice(0, 1)}{"*".repeat(Math.max(0, review.user_phone.length - 3))}{review.user_phone.slice(-2)}
            </p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg
                key={s}
                className={`w-3.5 h-3.5 ${s <= review.rating ? "text-yellow-400" : "text-gray-200"}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          {(isAdmin || isOwner) && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-6 h-6 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-40"
              title="Удалить отзыв"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
    </div>
  );
}
