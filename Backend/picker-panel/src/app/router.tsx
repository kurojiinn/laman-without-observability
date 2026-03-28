import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../pages/login/LoginPage";
import { OrdersPage } from "../pages/orders/OrdersPage";
import { OrderDetailsPage } from "../pages/order-details/OrderDetailsPage";
import { getSession } from "../features/auth/sessionStore";

function RequireAuth({ children }: { children: JSX.Element }) {
  const session = getSession();
  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/orders"
        element={
          <RequireAuth>
            <OrdersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <RequireAuth>
            <OrderDetailsPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}
