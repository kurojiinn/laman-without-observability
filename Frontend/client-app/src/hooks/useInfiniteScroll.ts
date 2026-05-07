"use client";

import { useEffect, useRef } from "react";

/**
 * useInfiniteScroll — автоматически вызывает onLoadMore когда сторожевой
 * элемент (sentinel) появляется в viewport. Используется в паре с
 * useInfiniteQuery для бесшовной подгрузки.
 *
 * Возвращает ref, который надо повесить на div в конце списка:
 *
 *   const sentinel = useInfiniteScroll(fetchNextPage, hasNextPage);
 *   ...
 *   <div ref={sentinel} />
 *
 * rootMargin '300px' заранее триггерит подгрузку — пользователь не успевает
 * увидеть конец списка.
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean,
  rootMargin: string = "300px",
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const node = ref.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMoreRef.current();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
