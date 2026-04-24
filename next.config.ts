import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",   // 정적 빌드 → Cloudflare Pages 직접 배포
  trailingSlash: true,
};

export default nextConfig;
