"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Loader2, Newspaper, Sparkles, Tag } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useBlogPostsQuery } from "@/services/blog/hooks";
import type { BlogPostSummary, PostType } from "@/services/blog/api";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_STYLE: Record<PostType, { labelKey: string; bg: string; text: string; dot: string }> = {
  news:      { labelKey: "post_type_news",      bg: "bg-sky-50",         text: "text-sky-700",     dot: "bg-sky-400"     },
  blog:      { labelKey: "post_type_blog",      bg: "bg-kun-primary/10", text: "text-kun-primary", dot: "bg-kun-primary" },
  promotion: { labelKey: "post_type_promotion", bg: "bg-amber-50",       text: "text-amber-700",   dot: "bg-amber-400"   },
};

const TYPE_COVER: Record<PostType, string> = {
  news:      "from-sky-500 to-blue-600",
  blog:      "from-[#1a3c34] to-[#2d6a4f]",
  promotion: "from-amber-400 to-orange-500",
};

const PAGE_LIMIT = 9;

function PostCard({ post, index }: { post: BlogPostSummary; index: number }) {
  const t = useTranslations();
  const style = TYPE_STYLE[post.type];
  const coverGrad = TYPE_COVER[post.type];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={ROUTES.BLOG_POST(post.slug)}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
      >
        <div className="relative aspect-video w-full overflow-hidden">
          {post.thumbnail ? (
            <Image
              src={post.thumbnail}
              alt={post.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${coverGrad}`}>
              <BookOpen className="size-12 text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${style.bg} ${style.text}`}>
              <span className={`size-1.5 rounded-full ${style.dot}`} />
              {t(style.labelKey as Parameters<typeof t>[0])}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Calendar className="size-3" />
              {fmtDate(post.publishedAt)}
            </span>
          </div>

          <h2 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-kun-primary">
            {post.title}
          </h2>

          <div className="mt-auto pt-4">
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-kun-primary/70 transition-colors group-hover:text-kun-primary">
              {t("read_more")} <ChevronRight className="size-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white">
      <div className="aspect-video w-full animate-pulse bg-surface-card" />
      <div className="space-y-3 p-5">
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-surface-card" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-surface-card" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-surface-card" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-card" />
      </div>
    </div>
  );
}

export function BlogPageShell() {
  const t = useTranslations();
  const [activeType, setActiveType] = useState<PostType | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useBlogPostsQuery({ type: activeType, page, limit: PAGE_LIMIT });

  const posts = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const FILTERS: { labelKey: string; value: PostType | undefined }[] = [
    { labelKey: "all",                value: undefined },
    { labelKey: "post_type_news",     value: "news" },
    { labelKey: "post_type_blog",     value: "blog" },
    { labelKey: "post_type_promotion", value: "promotion" },
  ];

  function handleFilter(type: PostType | undefined) {
    setActiveType(type);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-surface-soft">

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative container mx-auto max-w-[72rem] px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
              <Newspaper className="size-7 text-white" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{t("blog_eyebrow")}</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">{t("blog_and_news")}</h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60"
            >
              {t("blog_desc")}
            </motion.p>

            {!isLoading && total > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.16, type: "spring", stiffness: 200 }}
                className="mt-6 flex justify-center"
              >
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 ring-1 ring-white/15">
                  <Sparkles className="size-3.5 text-white/70" />
                  <span className="text-xs font-semibold text-white/80">{t("total_posts", { count: total })}</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Body */}
      <div className="container mx-auto max-w-[72rem] px-4 pb-20 pt-6 lg:px-8">

        {/* Filter chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              onClick={() => handleFilter(f.value)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                activeType === f.value
                  ? "bg-kun-primary text-white shadow-sm"
                  : "bg-white border border-black/8 text-foreground hover:bg-surface-card"
              }`}
            >
              {t(f.labelKey as Parameters<typeof t>[0])}
            </button>
          ))}
        </motion.div>

        {/* Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <PostCardSkeleton key={i} />)}
            </div>
          ) : posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-24 text-center"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-surface-card">
                <BookOpen className="size-6 text-muted" />
              </div>
              <p className="text-base font-medium text-foreground">{t("no_posts")}</p>
              <p className="text-sm text-muted">{t("check_back_later")}</p>
            </motion.div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 flex items-center justify-center gap-2"
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex size-9 items-center justify-center rounded-full border border-black/8 bg-white text-foreground transition-colors hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                const isActive = p === page;
                const show = p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                const showEllipsis = !show && (p === 2 || p === totalPages - 1);
                if (showEllipsis) return <span key={p} className="px-1 text-muted">…</span>;
                if (!show) return null;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      isActive ? "bg-kun-primary text-white shadow-sm" : "border border-black/8 bg-white text-foreground hover:bg-surface-card"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex size-9 items-center justify-center rounded-full border border-black/8 bg-white text-foreground transition-colors hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </motion.div>
        )}

        {!isLoading && totalPages > 1 && (
          <p className="mt-3 text-center text-[11px] text-muted">
            {t("page_indicator", { page, totalPages, total })}
          </p>
        )}
      </div>
    </div>
  );
}
