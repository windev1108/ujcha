import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: "./src/empty-module.js",
      encoding: "./src/empty-module.js",
    },
  },
};

export default withNextIntl(nextConfig);
