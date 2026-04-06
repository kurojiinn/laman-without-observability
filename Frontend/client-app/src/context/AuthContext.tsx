"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, type AuthUser } from "@/lib/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      // Восстанавливаем сессию: проверяем токен через GET /auth/me
      authApi
        .me()
        .then((u) => setUser(u))
        .catch(() => {
          // Токен протух — чистим
          localStorage.removeItem("token");
        })
        .finally(() => setHydrated(true));
    } else {
      setHydrated(true);
      const dismissed = sessionStorage.getItem("authModalDismissed");
      if (!dismissed) setIsAuthModalOpen(true);
    }
  }, []);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    sessionStorage.setItem("authModalDismissed", "true");
  }, []);

  const login = useCallback((token: string, userData: AuthUser) => {
    localStorage.setItem("token", token);
    sessionStorage.removeItem("authModalDismissed");
    setUser(userData);
    setIsAuthModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: user !== null,
        user,
        // До гидрации модалку не показываем — избегаем флика
        isAuthModalOpen: hydrated && isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
