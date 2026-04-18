import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Разрешаем доступ к dev-серверу с локального IP (не только localhost).
  // Без этого Next.js 15+ блокирует шрифты, HMR-вебсокеты и другие
  // dev-эндпоинты при обращении через 192.168.x.x → страница не гидрируется.
  allowedDevOrigins: ["192.168.0.6"],
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.0.6:3000", "localhost:3000"],
    },
  },
};

export default nextConfig;
