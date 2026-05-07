"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// Дефолты под наш use-case:
// - staleTime 60s — справочники (категории, магазины) почти не меняются;
//   60 секунд — компромисс между свежестью и количеством запросов
// - gcTime 5 мин — данные хранятся в памяти даже после анmount компонента,
//   при возврате на страницу показываются мгновенно
// - retry 1 — одна повторная попытка на сетевые сбои
// - refetchOnWindowFocus false — иначе любой alt-tab дёргает API
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  // useState чтобы клиент создавался один раз на mount, а не на каждый рендер.
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
