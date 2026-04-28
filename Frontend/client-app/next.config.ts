import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Разрешаем доступ к dev-серверу с локального IP (не только localhost).
  // Без этого Next.js 15+ блокирует шрифты, HMR-вебсокеты и другие
  // dev-эндпоинты при обращении через 192.168.x.x → страница не гидрируется.
  allowedDevOrigins: ["89.169.1.162"],
  experimental: {
    serverActions: {
      allowedOrigins: ["89.169.1.162:3000", "localhost:3000"],
    },
  },
};

export default nextConfig;
