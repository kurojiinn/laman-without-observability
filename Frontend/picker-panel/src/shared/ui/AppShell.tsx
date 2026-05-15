import { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { logout, useSession } from "../../features/auth/sessionStore";
import { usePickerOrders } from "../../features/orders/hooks";

// ── SVG Icons ────────────────────────────────────────────────────────────────

function IconOrders() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg className="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ── AppShell ─────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const session = useSession();
  const navigate = useNavigate();
  const ordersQuery = usePickerOrders();
  const newOrdersCount = useMemo(
    () => (ordersQuery.data ?? []).filter((o) => o.status === "NEW").length,
    [ordersQuery.data],
  );

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo"><svg viewBox="0 0 24 24" width="22" height="22" fill="white"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
          <div className="sidebar-brand-name">Yuhher</div>
          <div className="sidebar-brand-sub">Панель сборщика</div>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/orders"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <IconOrders />
            <span className="nav-label">Заказы</span>
            {newOrdersCount != null && newOrdersCount > 0 && (
              <span className="nav-badge">{newOrdersCount}</span>
            )}
          </NavLink>

          <NavLink
            to="/analytics"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <IconAnalytics />
            <span className="nav-label">Аналитика</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <IconProfile />
            <span className="nav-label">Профиль</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">👤</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-role">{session?.role ?? "PICKER"}</div>
              <div className="sidebar-user-store">
                {session?.storeId ? `Магазин #${session.storeId.slice(0, 6)}` : "Магазин не задан"}
              </div>
            </div>
          </div>
          <button className="logout-btn" type="button" onClick={handleLogout}>
            <IconLogout />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <div className="page-header">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        <div className="page-body">
          {children}
        </div>
      </div>
    </div>
  );
}
