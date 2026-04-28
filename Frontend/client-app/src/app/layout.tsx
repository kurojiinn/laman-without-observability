import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { OrderNotificationProvider } from "@/context/OrderNotificationContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AuthModal from "@/components/ui/AuthModal";
import OrderUpdateModal from "@/components/ui/OrderUpdateModal";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yuher — близкие магазины, быстрая доставка",
  description: "Yuher — доставка из ближайших магазинов. Продукты, еда, товары — быстро и рядом.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon-76.png" />
        <meta name="theme-color" content="#F5F6FC" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#08091C" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yuher" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
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
