"use client";

/**
 * Skeleton-компоненты — серые "болванки" интерфейса пока грузятся данные.
 *
 * Зачем: пользователь видит разметку будущего контента вместо пустого экрана.
 * Воспринимается как "уже работает", контент не "прыгает" при подгрузке.
 *
 * Все используют tailwind animate-pulse для лёгкой анимации мерцания.
 */

interface SkeletonProps {
  className?: string;
}

/** Базовый прямоугольник с пульсацией. */
export function SkeletonBox({ className = "" }: SkeletonProps) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

/** Карточка товара — image + 2 строки текста + цена + кнопка. */
export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
      <div className="aspect-square bg-gray-200 animate-pulse" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse" />
        <div className="flex items-center justify-between mt-1">
          <div className="h-4 bg-gray-200 rounded w-12 animate-pulse" />
          <div className="w-7 h-7 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/** Сетка из карточек товара. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Карточка магазина — аватар + название + адрес + бейдж. */
export function StoreCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gray-200 rounded-xl animate-pulse" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse" />
        <div className="h-5 bg-gray-200 rounded-full w-24 animate-pulse" />
      </div>
    </div>
  );
}

/** Сетка из карточек магазина. */
export function StoreGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StoreCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Горизонтальный ряд карточек товара (для главной — featured секции). */
export function FeaturedRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-36 sm:w-44 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="aspect-square bg-gray-200 animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Заголовок секции (название слева + ссылка справа). */
export function SectionHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-12 animate-pulse" />
    </div>
  );
}

/** Карточка заказа в истории. */
export function OrderCardSkeleton() {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        <div className="h-5 bg-gray-200 rounded-full w-16 animate-pulse" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
    </div>
  );
}

/** Сценарии-плитки (горизонтальные пилюли). */
export function ScenariosSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-32 h-20 bg-gray-200 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}
