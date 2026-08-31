import type { NextConfig } from "next";

// Configuração central do Next.js.
// Os IPs abaixo liberam o teste em rede local durante `next dev`.
// Em produção (Netlify/Vercel) esta configuração não é necessária.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.14", "192.168.1.18"],
};

export default nextConfig;
