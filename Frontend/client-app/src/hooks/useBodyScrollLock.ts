import { useEffect } from "react";

function lock() {
  const count = parseInt(document.body.dataset.modalCount ?? "0") + 1;
  document.body.dataset.modalCount = String(count);
  if (count === 1) {
    const scrollY = window.scrollY;
    document.body.dataset.scrollY = String(scrollY);
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
  }
}

function unlock() {
  const next = Math.max(0, parseInt(document.body.dataset.modalCount ?? "1") - 1);
  document.body.dataset.modalCount = String(next);
  if (next === 0) {
    const scrollY = parseInt(document.body.dataset.scrollY ?? "0");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);
    delete document.body.dataset.modalCount;
    delete document.body.dataset.scrollY;
  }
}

// For components that are always mounted but conditionally show a modal (e.g. controlled by state)
export function useBodyScrollLockWhen(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}

// For components that are conditionally rendered (mount = open)
export function useBodyScrollLock() {
  useEffect(() => {
    lock();
    return unlock;
  }, []);
}
