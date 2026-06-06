"use client";

import { motion } from "motion/react";
import { ArrowLeft, BookOpen, Calendar, Clock, Loader2, Newspaper, Tag } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useBlogPostQuery } from "@/services/blog/hooks";
import type { PostType } from "@/services/blog/api";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });
}

function estimateReadTime(content: string): number {
  const words = content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const TYPE_STYLE: Record<PostType, { labelKey: string; bg: string; text: string }> = {
  news:      { labelKey: "post_type_news",      bg: "bg-sky-50",         text: "text-sky-700"     },
  blog:      { labelKey: "post_type_blog",      bg: "bg-kun-primary/10", text: "text-kun-primary" },
  promotion: { labelKey: "post_type_promotion", bg: "bg-amber-50",       text: "text-amber-700"   },
};

const TYPE_COVER: Record<PostType, string> = {
  news:      "from-sky-600 via-blue-700 to-sky-800",
  blog:      "from-[#1a3c34] via-[#1e4438] to-[#112a21]",
  promotion: "from-amber-500 via-orange-500 to-amber-700",
};

export function BlogPostShell({ slug }: { slug: string }) {
  const t = useTranslations();
  const { data: post, isLoading, isError } = useBlogPostQuery(slug);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-kun-primary" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-surface-card">
          <Newspaper className="size-6 text-muted" />
        </div>
        <p className="text-base font-semibold text-foreground">{t("post_not_found")}</p>
        <p className="text-sm text-muted">{t("post_not_found_desc")}</p>
        <Link href={ROUTES.BLOG} className="mt-2 inline-flex items-center gap-2 rounded-full bg-kun-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
          <ArrowLeft className="size-4" /> {t("back_to_blog")}
        </Link>
      </div>
    );
  }

  const style = TYPE_STYLE[post.type];
  const coverGrad = TYPE_COVER[post.type];
  const readTime = estimateReadTime(post.content);

  return (
    <div className="min-h-screen bg-surface-soft">

      {/* Hero */}
      <section className={`relative overflow-hidden bg-gradient-to-br ${coverGrad} pb-20 pt-14 sm:pb-24 sm:pt-18`}>
        {post.thumbnail && (
          <div className="absolute inset-0">
            <Image src={post.thumbnail} alt={post.title} fill className="object-cover" sizes="100vw" unoptimized />
            <div className={`absolute inset-0 bg-gradient-to-br ${coverGrad} opacity-80`} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-64 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-80 rounded-full bg-white/[0.04] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.012]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative container mx-auto max-w-[72rem] px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Link
              href={ROUTES.BLOG}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/15 transition-colors hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="size-3.5" /> {t("all_posts")}
            </Link>
          </motion.div>

          <div className="mt-6 max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white ring-1 ring-white/20">
                <Tag className="size-3" /> {t(style.labelKey as Parameters<typeof t>[0])}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/60">
                <Calendar className="size-3.5" /> {fmtDate(post.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/60">
                <Clock className="size-3.5" /> {t("min_read", { count: readTime })}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl lg:text-4xl"
            >
              {post.title}
            </motion.h1>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto max-w-[72rem] px-4 pb-20 pt-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* Main article */}
          <motion.article
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="min-w-0 flex-1 rounded-3xl border border-black/6 bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-8 lg:p-10"
          >
            <div className="kun-prose" dangerouslySetInnerHTML={{ __html: post.content }} />
          </motion.article>

          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="w-full space-y-4 lg:w-64 lg:shrink-0 lg:sticky lg:top-20"
          >
            <div className="rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("post_info")}</p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-card">
                    <Tag className="size-3.5 text-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">{t("topic")}</p>
                    <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
                      {t(style.labelKey as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-card">
                    <Calendar className="size-3.5 text-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">{t("published_at")}</p>
                    <p className="text-xs font-medium text-foreground">{fmtDate(post.publishedAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-card">
                    <Clock className="size-3.5 text-muted" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">{t("reading_time")}</p>
                    <p className="text-xs font-medium text-foreground">{t("read_time_approx", { count: readTime })}</p>
                  </div>
                </div>
              </div>
            </div>

            <Link
              href={ROUTES.BLOG}
              className="flex items-center justify-center gap-2 rounded-full border border-black/8 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-card"
            >
              <ArrowLeft className="size-4" /> {t("see_all_posts")}
            </Link>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
