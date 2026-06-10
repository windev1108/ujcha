import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BlogPostShell } from "./components/BlogPostShell";

export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ujcha.vercel.app";

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; locale: string }> }
): Promise<Metadata> {
  const { slug, locale } = await params;
  try {
    const res = await fetch(`${API_URL}/blog/posts/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { title: "Bài viết" };
    const post = await res.json();
    const description = stripHtml(post.content ?? "").slice(0, 155);
    const canonicalUrl = `${SITE_URL}/${locale}/blog/${slug}`;
    return {
      title: post.title,
      description,
      alternates: {
        canonical: canonicalUrl,
        languages: {
          vi: `${SITE_URL}/blog/${slug}`,
          en: `${SITE_URL}/blog/${slug}`,
          "x-default": `${SITE_URL}/blog/${slug}`,
        },
      },
      openGraph: {
        title: post.title,
        description,
        type: "article",
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt,
        authors: ["UjCha"],
        url: canonicalUrl,
        siteName: "UjCha",
        ...(post.thumbnail
          ? { images: [{ url: post.thumbnail, alt: post.title, width: 1200, height: 630 }] }
          : {
            images: [
              {
                url: `/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(description)}`,
                width: 1200,
                height: 630,
                alt: post.title,
              },
            ],
          }),
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description,
        images: [
          post.thumbnail ??
          `/api/og?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(description)}`,
        ],
      },
    };
  } catch {
    return { title: "Bài viết" };
  }
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-kun-primary" />
    </div>
  );
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

  let structuredData: object | null = null;
  try {
    const res = await fetch(`${API_URL}/blog/posts/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const post = await res.json();
      const description = stripHtml(post.content ?? "").slice(0, 155);
      structuredData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${SITE_URL}/${locale}/blog/${slug}`,
        headline: post.title,
        description,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt ?? post.publishedAt,
        url: `${SITE_URL}/${locale}/blog/${slug}`,
        image:
          post.thumbnail ??
          `${SITE_URL}/api/og?title=${encodeURIComponent(post.title ?? "")}&description=${encodeURIComponent(stripHtml(post.content ?? "").slice(0, 120))}`,
        inLanguage: locale === "vi" ? "vi-VN" : "en-US",
        author: {
          "@type": "Organization",
          name: "UjCha",
          url: SITE_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "UjCha",
          url: SITE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${SITE_URL}/logo.png`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${SITE_URL}/${locale}/blog/${slug}`,
        },
        isPartOf: {
          "@type": "Blog",
          name: "UjCha Blog",
          url: `${SITE_URL}/${locale}/blog`,
        },
      };
    }
  } catch {
    // structured data is optional — page still renders
  }

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <Suspense fallback={<PageFallback />}>
        <BlogPostShell slug={slug} />
      </Suspense>
    </>
  );
}
