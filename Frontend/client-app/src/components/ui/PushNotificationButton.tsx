"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush, getPushState } from "@/lib/push";

type PushState = "granted" | "denied" | "default" | "unsupported" | "loading";

function BellIcon({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" opacity=".3" />
      <path d="M20.84 22.73L1.11 3 2.39 1.73l19.73 19.73-1.28 1.27z" />
    </svg>
  );
}

export default function PushNotificationButton() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    if (state === "granted") {
      await unsubscribeFromPush();
      setState("default");
    } else {
      const ok = await subscribeToPush();
      setState(ok ? "granted" : await getPushState());
    }
    setBusy(false);
  }

  const rowBase = "flex items-center justify-between py-3";

  if (state === "loading") {
    return (
      <div className={rowBase}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
          <div className="w-32 h-3.5 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className={rowBase}>
        <div className="flex items-center gap-3">
          <BellIcon enabled={false} />
          <div>
            <p className="text-sm text-gray-700">Уведомления о заказах</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Доступно только из установленного приложения
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={rowBase}>
        <div className="flex items-center gap-3">
          <BellIcon enabled={false} />
          <div>
            <p className="text-sm text-gray-700">Уведомления о заказах</p>
            <p className="text-xs text-red-400 mt-0.5">
              Заблокированы — разрешите в настройках
            </p>
          </div>
        </div>
      </div>
    );
  }

  const enabled = state === "granted";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`${rowBase} w-full text-left transition-opacity ${busy ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <BellIcon enabled={enabled} />
        <div>
          <p className="text-sm text-gray-700">Уведомления о заказах</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {enabled ? "Включены — нажмите чтобы отключить" : "Нажмите чтобы включить"}
          </p>
        </div>
      </div>
      {/* Toggle */}
      <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-indigo-500" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </div>
    </button>
  );
}
