import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./src/empty-module.js",
      encoding: "./src/empty-module.js",
    },
  },
  images: {
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

export default nextConfig;
