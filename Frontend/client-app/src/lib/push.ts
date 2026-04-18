import { api } from "@/lib/api";

async function getVapidKey(): Promise<string> {
  const res = await api.get<{ public_key: string }>("/v1/push/vapid-key");
  return res.public_key;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

// Safari не экспортирует PushManager как глобал — нужно проверять через SW registration.
async function getRegistrationWithPush(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.pushManager) return null;
    return reg;
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  const reg = await getRegistrationWithPush();
  if (!reg) return "unsupported";
  return Notification.permission;
}

export async function subscribeToPush(): Promise<boolean> {
  const reg = await getRegistrationWithPush();
  if (!reg) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  try {
    const vapidKey = await getVapidKey();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const json = sub.toJSON();
    await api.post("/v1/push/subscribe", {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    });
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await getRegistrationWithPush();
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await api.post("/v1/push/unsubscribe", { endpoint: sub.endpoint });
  await sub.unsubscribe();
}
