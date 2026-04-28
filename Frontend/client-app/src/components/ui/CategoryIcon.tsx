// Централизованные иконки категорий магазинов.
// Используется в CategoriesTab, StoreDetailView, StoresTab.

export type StoreCategoryType =
  | "FOOD"
  | "PHARMACY"
  | "BUILDING"
  | "HOME"
  | "GROCERY"
  | "SWEETS";

export interface CategoryMeta {
  label: string;
  bg: string; // bg для иконки-плашки
  badgeClass: string; // pill-бейджик в шапке магазина
  gridBg: string; // градиент для плитки категорий (фоллбэк без фото)
  icon: React.ReactNode;
  bgImageFile?: string; // имя файла в /uploads/ для фона плитки
}

const icons: Record<string, React.ReactNode> = {
  FOOD: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[22%]"
    >
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),

  PHARMACY: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[20%]"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),

  BUILDING: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[20%]"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  ),

  HOME: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[20%]"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),

  CLOTHES: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[18%]"
    >
      <path d="M20.38 8.57l-1.23 1.85A8 8 0 0117.92 19H6.08a8 8 0 01-1.23-8.58L3.62 8.57A2 2 0 015.4 5.5h.4a2 2 0 012 1.6 2 2 0 004 0 2 2 0 012-1.6h.4a2 2 0 011.78 3.07z" />
    </svg>
  ),

  AUTO: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[20%]"
    >
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),

  DEFAULT: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-full h-full p-[20%]"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  FOOD: {
    label: "Еда",
    bg: "bg-orange-500",
    badgeClass: "bg-orange-100 text-orange-700",
    gridBg: "from-orange-100 to-amber-50",
    icon: icons.FOOD,
  },
  GROCERY: {
    label: "Продукты",
    bg: "bg-emerald-500",
    badgeClass: "bg-emerald-100 text-emerald-700",
    gridBg: "from-emerald-100 to-green-50",
    icon: icons.FOOD,
  },
  PHARMACY: {
    label: "Аптеки",
    bg: "bg-rose-500",
    badgeClass: "bg-rose-100 text-rose-700",
    gridBg: "from-rose-100 to-red-50",
    icon: icons.PHARMACY,
  },
  SWEETS: {
    label: "Сладости и подарки",
    bg: "bg-pink-500",
    badgeClass: "bg-pink-100 text-pink-700",
    gridBg: "from-pink-100 to-rose-50",
    icon: icons.FOOD,
  },
  HOME: {
    label: "Химия и быт",
    bg: "bg-sky-500",
    badgeClass: "bg-sky-100 text-sky-700",
    gridBg: "from-sky-100 to-blue-50",
    icon: icons.HOME,
  },
  BUILDING: {
    label: "Стройматериалы",
    bg: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-700",
    gridBg: "from-amber-100 to-orange-50",
    icon: icons.BUILDING,
  },
};

export const DEFAULT_META: CategoryMeta = {
  label: "Магазин",
  bg: "bg-gray-400",
  badgeClass: "bg-gray-100 text-gray-600",
  gridBg: "from-gray-100 to-gray-50",
  icon: icons.DEFAULT,
};

// ─── Компонент: цветной квадрат с иконкой ─────────────────────────────────────

interface CategoryIconProps {
  type: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClass = {
  sm: "w-10 h-10 rounded-xl",
  md: "w-12 h-12 rounded-xl",
  lg: "w-14 h-14 rounded-2xl",
};

export default function CategoryIcon({
  type,
  size = "md",
  className = "",
}: CategoryIconProps) {
  const meta = CATEGORY_META[type] ?? DEFAULT_META;
  return (
    <div
      className={`${meta.bg} ${sizeClass[size]} flex items-center justify-center flex-shrink-0 ${className}`}
    >
      {meta.icon}
    </div>
  );
}
