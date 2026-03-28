import { Link, useNavigate } from "react-router-dom";
import { logout, useSession } from "../../features/auth/sessionStore";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const session = useSession();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>{title}</h1>
          <p className="subtitle">
            Роль: {session?.role ?? "UNKNOWN"} | Store: {session?.storeId ?? "not set"}
          </p>
        </div>
        <nav className="topbar-nav">
          <Link to="/orders">Заказы</Link>
          <button type="button" onClick={handleLogout}>
            Выйти
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
