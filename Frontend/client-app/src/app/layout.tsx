import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { OrderNotificationProvider } from "@/context/OrderNotificationContext";
import AuthModal from "@/components/ui/AuthModal";
import OrderUpdateModal from "@/components/ui/OrderUpdateModal";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laman — доставка в Грозном",
  description: "Сервис доставки чего угодно",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <FavoritesProvider>
              <OrderNotificationProvider>
                {children}
                <AuthModal />
                <OrderUpdateModal />
              </OrderNotificationProvider>
            </FavoritesProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
