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
import { tokenStore } from "@/lib/tokenStore";

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
    // Сессия восстанавливается через httpOnly cookie — браузер отправляет его автоматически.
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        // Cookie не валидна или отсутствует — пользователь не авторизован
      })
      .finally(() => setHydrated(true));
  }, []);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const login = useCallback((token: string, userData: AuthUser) => {
    tokenStore.set(token);
    setUser(userData);
    setIsAuthModalOpen(false);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
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
