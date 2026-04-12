"use client";

import { useEffect, useState } from "react";
import { catalogApi, reviewsApi, resolveImageUrl, type Store, type Product, type Review } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import ProductModal from "@/components/ui/ProductModal";
import { useFavorites } from "@/context/FavoritesContext";
import CategoryIcon, { CATEGORY_META, DEFAULT_META } from "@/components/ui/CategoryIcon";
import StoreAvatar from "@/components/ui/StoreAvatar";

// Re-export for backward compatibility (StoresTab, CategoriesTab импортируют отсюда)
export { CATEGORY_META as STORE_CATEGORY_META };

export default function StoreDetailView({
  store,
  onBack,
  targetProductId,
}: {
  store: Store;
  onBack: () => void;
  targetProductId?: string;
}) {
  const meta = CATEGORY_META[store.category_type] ?? DEFAULT_META;

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "reviews">("products");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { items: cartItems, addItem } = useCart();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    setProductsLoading(true);
    catalogApi
      .getStoreProducts(store.id)
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [store.id]);

  useEffect(() => {
    setReviews(reviewsApi.getByStore(store.id));
  }, [store.id]);

  // Скроллим к целевому товару после загрузки
  useEffect(() => {
    if (!targetProductId || productsLoading || products.length === 0) return;
    const el = document.getElementById(`product-${targetProductId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    }
  }, [targetProductId, productsLoading, products]);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : store.rating;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-5"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Назад
      </button>

      {/* Шапка магазина */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <StoreAvatar store={store} className="w-16 h-16 rounded-2xl" textClass="text-xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">{store.address}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${meta.badgeClass}`}>
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

              {store.phone && (
                <a href={`tel:${store.phone}`} className="text-sm text-indigo-500 hover:text-indigo-700 transition-colors">
                  {store.phone}
                </a>
              )}
            </div>

            {store.description && (
              <p className="text-sm text-gray-500 mt-2">{store.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-gray-200 mb-5 gap-6">
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "products"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Товары {products.length > 0 ? `(${products.length})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "reviews"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Отзывы {reviews.length > 0 ? `(${reviews.length})` : ""}
        </button>
      </div>

      {activeTab === "products" && (
        <>
          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "reviews" && (
        <ReviewsSection
          storeId={store.id}
          reviews={reviews}
          isAuthenticated={isAuthenticated}
          userPhone={user?.phone ?? ""}
          onReviewAdded={(r) => setReviews((prev) => [r, ...prev])}
        />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          storeName={store.name}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

// ─── Store Product Card ────────────────────────────────────────────────────────

function StoreProductCard({
  product,
  cartQty,
  onAdd,
  onOpen,
  isTarget,
}: {
  product: Product;
  cartQty: number;
  onAdd: () => void;
  onOpen: () => void;
  isTarget?: boolean;
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
      <button
        onClick={handleFav}
        className="absolute top-3 right-3 z-10 w-7 h-7 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={fav ? "#ef4444" : "none"} stroke={fav ? "#ef4444" : "#9ca3af"} strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      <div className="w-full h-28 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
        {product.image_url ? (
          <img src={resolveImageUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">🛍️</span>
        )}
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-sm font-bold text-gray-900">
          {product.price.toLocaleString("ru-RU")} ₽
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      {cartQty > 0 && (
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
  userPhone,
  onReviewAdded,
}: {
  storeId: string;
  reviews: Review[];
  isAuthenticated: boolean;
  userPhone: string;
  onReviewAdded: (r: Review) => void;
}) {
  const { openAuthModal } = useAuth();
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    const review = reviewsApi.add({
      store_id: storeId,
      user_phone: userPhone,
      rating,
      comment: comment.trim(),
    });
    onReviewAdded(review);
    setComment("");
    setRating(5);
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Оставить отзыв</h3>

        {!isAuthenticated ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <p className="text-sm text-gray-500">Войдите, чтобы оставить отзыв</p>
            <button
              onClick={openAuthModal}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Войти
            </button>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={!comment.trim() || submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Отправить отзыв
            </button>
          </form>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <span className="text-5xl mb-3">💬</span>
          <p className="text-sm">Отзывов пока нет. Будьте первым!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });

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
              +{review.user_phone.slice(0, 1)}{"*".repeat(review.user_phone.length - 3)}{review.user_phone.slice(-2)}
            </p>
            <p className="text-xs text-gray-400">{date}</p>
          </div>
        </div>
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
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
    </div>
  );
}
