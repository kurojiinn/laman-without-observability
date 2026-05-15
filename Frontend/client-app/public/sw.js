self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
  );
});

// No fetch interception — browser handles all requests natively.
// SW exists only for push notifications.

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Yuhher", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: {
        url: data.url ?? "/",
        orderId: data.order_id ?? "",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  const orderId = event.notification.data?.orderId ?? "";

  event.waitUntil((async () => {
    // Если приложение уже открыто — фокусируем и шлём postMessage.
    // Клиент откроет модалку без перезагрузки (см. OrderNotificationContext).
    const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = list.find((c) => {
      try {
        return new URL(c.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: "open-order", orderId, url });
      return;
    }
    // Окна нет — открываем новое. На холодном старте клиент прочитает
    // ?order=<id> из URL и откроет модалку.
    await clients.openWindow(url);
  })());
});
