import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./src/empty-module.js",
      encoding: "./src/empty-module.js",
    },
  },
};

export default nextConfig;
