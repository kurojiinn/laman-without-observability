import { useEffect, useState } from "react";
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "../../shared/lib/push";

type State = PushState | "loading";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
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
      if (ok) {
        setState("granted");
      } else {
        const ps = await getPushState();
        setState(ps);
      }
    }
    setBusy(false);
  }

  if (state === "loading") {
    return (
      <div className="info-item">
        <span className="info-label">Уведомления о заказах</span>
        <span className="info-value">…</span>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="info-item">
        <span className="info-label">Уведомления о заказах</span>
        <span className="info-value" style={{ color: "var(--text-muted)" }}>
          Доступно только в установленном PWA
        </span>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="info-item">
        <span className="info-label">Уведомления о заказах</span>
        <span className="info-value" style={{ color: "var(--red)" }}>
          Заблокированы — разрешите в настройках браузера
        </span>
      </div>
    );
  }

  const enabled = state === "granted";

  return (
    <div className="info-item">
      <span className="info-label">Уведомления о новых заказах</span>
      <label className="toggle-switch" style={{ opacity: busy ? 0.5 : 1 }}>
        <input type="checkbox" checked={enabled} onChange={toggle} disabled={busy} />
        <span className="toggle-track" />
      </label>
    </div>
  );
}
