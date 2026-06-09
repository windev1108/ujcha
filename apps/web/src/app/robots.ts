import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/checkout",
          "/cart",
          "/orders",
          "/profile",
          "/login",
          "/register",
          "/forgot-password",
          "/vouchers",
          "/loyalty",
          "/rewards",
          "/feedback",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
