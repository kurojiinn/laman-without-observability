import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import type { Page } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { StoresPage } from "./pages/StoresPage";
import { ProductsPage } from "./pages/ProductsPage";
import { VitrinaPage } from "./pages/VitrinaPage";
import { RecipesPage } from "./pages/RecipesPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ScenariosPage } from "./pages/ScenariosPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ProductCategoriesPage } from "./pages/ProductCategoriesPage";
import { PickersPage } from "./pages/PickersPage";
import { BannersPage } from "./pages/BannersPage";

function AdminApp() {
  const queryClient = useQueryClient();
  const [creds, setCreds] = useState<{ user: string; password: string } | null>(() => {
    const u = sessionStorage.getItem("admin_user");
    const p = sessionStorage.getItem("admin_password");
    return u && p ? { user: u, password: p } : null;
  });
  const [page, setPage] = useState<Page>("dashboard");
  const [loginForm, setLoginForm] = useState({ user: "", password: "" });
  const [loginError, setLoginError] = useState("");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginForm.user.trim() || !loginForm.password.trim()) {
      setLoginError("Введите логин и пароль");
      return;
    }
    sessionStorage.setItem("admin_user", loginForm.user.trim());
    sessionStorage.setItem("admin_password", loginForm.password.trim());
    setCreds({ user: loginForm.user.trim(), password: loginForm.password.trim() });
    setLoginError("");
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_user");
    sessionStorage.removeItem("admin_password");
    setCreds(null);
    setLoginForm({ user: "", password: "" });
    queryClient.clear();
  }

  if (!creds) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Yuhher Admin</h1>
            <p className="text-gray-400 text-sm mt-1">Панель управления</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Логин</label>
              <input
                type="text"
                autoComplete="username"
                value={loginForm.user}
                onChange={(e) => setLoginForm((p) => ({ ...p, user: e.target.value }))}
                placeholder="admin"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Пароль</label>
              <input
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                style={{ fontSize: 16 }}
              />
            </div>
            {loginError && <p className="text-xs text-red-500">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout page={page} onNavigate={setPage} onLogout={handleLogout} user={creds.user}>
      {page === "dashboard" && <DashboardPage user={creds.user} password={creds.password} />}
      {page === "stores" && <StoresPage user={creds.user} password={creds.password} />}
      {page === "products" && <ProductsPage user={creds.user} password={creds.password} />}
      {page === "vitrina" && <VitrinaPage user={creds.user} password={creds.password} />}
      {page === "recipes" && <RecipesPage user={creds.user} password={creds.password} />}
      {page === "orders" && <OrdersPage user={creds.user} password={creds.password} />}
      {page === "scenarios" && <ScenariosPage user={creds.user} password={creds.password} />}
      {page === "categories" && <CategoriesPage user={creds.user} password={creds.password} />}
      {page === "product-categories" && <ProductCategoriesPage user={creds.user} password={creds.password} />}
      {page === "pickers" && <PickersPage user={creds.user} password={creds.password} />}
      {page === "banners" && <BannersPage user={creds.user} password={creds.password} />}
    </Layout>
  );
}

export const App = () => <AdminApp />;
