"use client";

import { Component, type ReactNode } from "react";

/**
 * Локальный ErrorBoundary для изоляции секций.
 *
 * Зачем: если в одной секции (например рецепты) бросилось исключение,
 * без boundary падает вся страница в белый экран. С boundary —
 * упавшая секция показывает fallback, остальные продолжают работать.
 *
 * Использование:
 *   <ErrorBoundary fallback={<div>Не удалось загрузить рецепты</div>}>
 *     <RecipesBanner ... />
 *   </ErrorBoundary>
 *
 * React 19 deprecates legacy class API, но class components — единственный
 * способ ловить ошибки рендера (componentDidCatch). useErrorBoundary хук
 * пока не входит в stable.
 */
interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Здесь можно логировать в Sentry / Telegram. Пока консоль для dev.
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/** Стандартный fallback для секций — компактная плашка с эмодзи + текстом. */
export function SectionErrorFallback({ message = "Не удалось загрузить" }: { message?: string }) {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-6 flex items-center gap-3 text-orange-700">
      <span className="text-2xl">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{message}</p>
        <p className="text-xs text-orange-500 mt-0.5">Попробуйте обновить страницу</p>
      </div>
    </div>
  );
}
