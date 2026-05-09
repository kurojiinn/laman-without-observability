/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback — отдаём index.html из precache для всех навигаций
// внутри /picker/, исключая API. URL должен совпадать с тем что vite-plugin-pwa
// кладёт в __WB_MANIFEST — это "index.html" без /picker/ префикса.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//],
  }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return {};
    }
  })();

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Yuher", {
      body: data.body ?? "",
      icon: "/picker/icons/icon-192.png",
      badge: "/picker/icons/icon-192.png",
      data: {
        url: data.url ?? "/picker/",
        orderId: data.order_id ?? "",
      },
      tag: data.order_id || undefined,
      requireInteraction: false,
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/picker/";

  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = list.find((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) {
          await (existing as WindowClient).navigate(url).catch(() => {});
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
