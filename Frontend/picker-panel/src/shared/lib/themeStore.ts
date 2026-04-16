import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "picker.theme.v1";

let theme: Theme = loadTheme();
const listeners = new Set<() => void>();

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

function emit() {
  listeners.forEach((l) => l());
}

export function getTheme(): Theme {
  return theme;
}

export function setTheme(next: Theme) {
  theme = next;
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  emit();
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}

// Apply on startup
applyTheme(theme);
