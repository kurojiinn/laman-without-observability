"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { favoritesApi, type Product } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface FavoritesContextValue {
  favorites: Product[];
  favoriteIds: Set<string>;
  loading: boolean;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!isAuthenticated) {
      setFavorites([]);
      return;
    }
    setLoading(true);
    favoritesApi
      .getAll()
      .then((data) => setFavorites(data ?? []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  const favoriteIds = new Set(favorites.map((p) => p.id));

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.has(productId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (product: Product) => {
      if (favoriteIds.has(product.id)) {
        setFavorites((prev) => prev.filter((p) => p.id !== product.id));
        await favoritesApi.remove(product.id).catch(() => {
          // Rollback on error
          setFavorites((prev) => [product, ...prev]);
        });
      } else {
        setFavorites((prev) => [product, ...prev]);
        await favoritesApi.add(product.id).catch(() => {
          // Rollback on error
          setFavorites((prev) => prev.filter((p) => p.id !== product.id));
        });
      }
    },
    [favoriteIds]
  );

  return (
    <FavoritesContext.Provider
      value={{ favorites, favoriteIds, loading, isFavorite, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
