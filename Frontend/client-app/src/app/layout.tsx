import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { OrderNotificationProvider } from "@/context/OrderNotificationContext";
import { ThemeProvider } from "@/context/ThemeContext";
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

// Скрипт применяется до рендера, чтобы не было мигания при тёмной теме
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('theme');
      if (t === 'dark') document.documentElement.classList.add('dark');
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
