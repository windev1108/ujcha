import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from "next-intl/plugin";

/** Monorepo root (kun/) — Next yêu cầu `turbopack.root` và `outputFileTracingRoot` cùng giá trị. */
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    // Cache optimized images for 24 h — reduces repeat transformations on Vercel
    minimumCacheTTL: 86400,
    // Only generate the breakpoints actually needed by the UI
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256],
    // Prefer AVIF → WebP → original
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
