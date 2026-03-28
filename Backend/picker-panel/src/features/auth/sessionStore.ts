import { useSyncExternalStore } from "react";

export type PickerSession = {
  token: string;
  userId: string;
  storeId: string | null;
  role: string;
};

const SESSION_KEY = "picker.session.v1";

let session: PickerSession | null = loadSession();
const listeners = new Set<() => void>();

function loadSession(): PickerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PickerSession;
  } catch {
    return null;
  }
}

function persist(value: PickerSession | null) {
  if (!value) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSession() {
  return session;
}

export function setSession(next: PickerSession | null) {
  session = next;
  persist(next);
  emit();
}

export function logout() {
  setSession(null);
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}
