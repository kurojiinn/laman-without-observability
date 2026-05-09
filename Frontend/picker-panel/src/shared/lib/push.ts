import { httpRequest } from "../api/http";

async function getVapidKey(): Promise<string> {
  const res = await httpRequest<{ public_key: string }>("/api/v1/push/vapid-key");
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

async function getRegistrationWithPush(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg?.pushManager) return null;
    return reg;
  } catch {
    return null;
  }
}

export type PushState = "granted" | "denied" | "default" | "unsupported";

export async function getPushState(): Promise<PushState> {
  const reg = await getRegistrationWithPush();
  if (!reg) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "granted" : "default";
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
    await httpRequest("/api/v1/push/subscribe", {
      method: "POST",
      authorized: true,
      body: {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
    });
    return true;
  } catch (err) {
    console.error("[Push] Subscribe failed:", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await getRegistrationWithPush();
  if (!reg) return;

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await sub.unsubscribe();
  httpRequest("/api/v1/push/unsubscribe", {
    method: "POST",
    authorized: true,
    body: { endpoint: sub.endpoint },
  }).catch(() => {});
}
