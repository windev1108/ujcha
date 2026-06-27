import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const locales = ["vi", "en"];

async function getBlogPosts(): Promise<{ slug: string; updatedAt?: string; publishedAt?: string }[]> {
  try {
    const res = await fetch(`${API_URL}/blog/posts?limit=200&status=published`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/menu", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/blog", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/promotions", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/group-order", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/referral", priority: 0.5, changeFrequency: "monthly" as const },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.flatMap(
    ({ path, priority, changeFrequency }) =>
      locales.map(() => ({
        url: `${SITE_URL}/${path}`,
        lastModified: now,
        changeFrequency,
        priority,
        alternates: {
          languages: Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
        },
      }))
  );

  const posts = await getBlogPosts();
  const blogEntries: MetadataRoute.Sitemap = posts.flatMap((post) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt ?? post.publishedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${SITE_URL}/${l}/blog/${post.slug}`])
        ),
      },
    }))
  );

  return [...staticEntries, ...blogEntries];
}
