// Аватарка магазина: фото если есть, иначе инициалы на цветном фоне.
// Цвет фона берётся из категории магазина.

import { resolveImageUrl, type Store } from "@/lib/api";
import { CATEGORY_META, DEFAULT_META } from "@/components/ui/CategoryIcon";

// Извлекает 1–2 заглавные буквы из названия магазина
function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface Props {
  store: Store;
  className?: string;   // размер и скругление снаружи (w-12 h-12 rounded-xl и т.п.)
  textClass?: string;   // размер текста инициалов
}

export default function StoreAvatar({ store, className = "w-12 h-12 rounded-xl", textClass = "text-sm" }: Props) {
  const meta = CATEGORY_META[store.category_type] ?? DEFAULT_META;

  if (store.image_url) {
    return (
      <div className={`overflow-hidden flex-shrink-0 ${className}`}>
        <img
          src={resolveImageUrl(store.image_url)}
          alt={store.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`${meta.bg} flex items-center justify-center flex-shrink-0 ${className}`}>
      <span className={`text-white font-bold select-none ${textClass}`}>
        {getInitials(store.name)}
      </span>
    </div>
  );
}
