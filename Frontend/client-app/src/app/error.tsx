"use client";

import { useEffect } from "react";

/**
 * Глобальный error boundary для всего приложения.
 * Next.js App Router автоматически использует этот файл когда любой
 * client-component падает с исключением во время рендера.
 *
 * Без него пользователь видел бы белый экран. С ним — понятный fallback
 * с кнопкой "Попробовать снова" (вызывает reset, ремаунтит дерево).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // В production здесь можно слать в Sentry/Telegram.
    // Пока просто в консоль для разработчиков.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="text-7xl mb-6">😔</span>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Что-то пошло не так
      </h2>
      <p className="text-sm text-gray-500 mb-8 max-w-sm">
        Мы уже знаем о проблеме. Попробуйте перезагрузить страницу — обычно это помогает.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all"
        >
          Попробовать снова
        </button>
        <button
          onClick={() => { window.location.href = "/"; }}
          className="px-6 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
        >
          На главную
        </button>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-gray-400">
          ID: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
