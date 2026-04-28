import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Разрешаем доступ к dev-серверу с локального IP (не только localhost).
  // Без этого Next.js 15+ блокирует шрифты, HMR-вебсокеты и другие
  // dev-эндпоинты при обращении через 192.168.x.x → страница не гидрируется.
  allowedDevOrigins: ["yuher.ru", "www.yuher.ru"],
  experimental: {
    serverActions: {
      allowedOrigins: ["yuher.ru", "www.yuher.ru", "localhost:3000"],
    },
  },
};

export default nextConfig;
