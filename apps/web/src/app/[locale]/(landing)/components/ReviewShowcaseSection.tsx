"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Star, Quote, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fetchPinnedFeedbacks, type PinnedFeedback } from "@/services/feedback/api";
import { RevealSection, easeOutSmooth } from "./RevealSection";

function ReviewCard({ review }: { review: PinnedFeedback }) {
  const t = useTranslations();
  const locale = useLocale();
  const isGrab = review.externalId?.startsWith("grab:");
  const date = new Date(review.createdAt).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const card = (
    // Fixed height so every card in the row is identical regardless of content length
    <div className="group relative flex h-[260px] w-[300px] shrink-0 select-none flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_4px_20px_-6px_rgba(26,60,52,0.09)] transition-shadow duration-300 hover:shadow-[0_10px_36px_-6px_rgba(26,60,52,0.18)]">
      {/* decorative quote */}
      <Quote className="absolute right-4 top-4 size-10 rotate-180 text-[#1a3c34]/[0.05]" />

      {/* stars + source badge */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`size-3.5 ${
                i < (review.rating ?? 0)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-current text-foreground/[0.08]"
              }`}
            />
          ))}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
            isGrab
              ? "bg-[#00b14f]/10 text-[#00b14f]"
              : "bg-[#1a3c34]/8 text-[#1a3c34]"
          }`}
        >
          {isGrab ? "GrabFood" : "UjCha"}
        </span>
      </div>

      {/* review text — clamped to 3 lines */}
      <p className="mt-3 shrink-0 text-sm leading-relaxed text-foreground/65 line-clamp-3">
        {review.content}
      </p>

      {/* flexible spacer pushes chip + author to the bottom */}
      <div className="flex-1" />

      {/* product chip — anchored just above author */}
      {review.linkedProduct && (
        <div className="mb-3 flex shrink-0 items-center gap-2.5 rounded-2xl bg-[#f0f7f4] p-2.5 transition-colors duration-200 group-hover:bg-[#e5f0ea]">
          {review.linkedProduct.imageUrls[0] && (
            <div className="relative size-9 shrink-0 overflow-hidden rounded-xl">
              <Image
                src={review.linkedProduct.imageUrls[0]}
                alt={review.linkedProduct.name}
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5a8f7a]">
              {t("review_card_ordered_item")}
            </p>
            <p className="truncate text-sm font-semibold text-[#1a3c34]">
              {review.linkedProduct.name}
            </p>
          </div>
          <ArrowRight className="size-3.5 shrink-0 text-[#1a3c34]/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#1a3c34]/60" />
        </div>
      )}

      {/* author + date */}
      <div className="flex shrink-0 items-center justify-between border-t border-black/[0.04] pt-3">
        <p className="text-sm font-semibold text-foreground">
          {review.name ?? t("review_card_anonymous")}
        </p>
        <p className="text-[11px] text-muted">{date}</p>
      </div>
    </div>
  );

  if (review.linkedProduct) {
    return (
      <Link href={`/menu/${review.linkedProduct.slug}`} className="shrink-0">
        {card}
      </Link>
    );
  }
  return card;
}

function MarqueeTrack({ reviews, duration }: { reviews: PinnedFeedback[]; duration: number }) {
  // 3 copies → animate -33.333% for a seamless loop at any screen width
  const items = [...reviews, ...reviews, ...reviews];
  return (
    <div className="overflow-hidden">
      <div
        className="rss-scroll flex w-max gap-4 pr-4"
        style={{ animationDuration: `${duration}s` }}
      >
        {items.map((r, i) => (
          <ReviewCard key={`${r.id}-${i}`} review={r} />
        ))}
      </div>
    </div>
  );
}

export function ReviewShowcaseSection() {
  const t = useTranslations();

  const { data: reviews } = useQuery({
    queryKey: ["feedback", "pinned"],
    queryFn: fetchPinnedFeedbacks,
    staleTime: 5 * 60 * 1000,
  });

  if (!reviews || reviews.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes rss-scroll {
          to { transform: translateX(-33.3333%); }
        }
        .rss-scroll { animation: rss-scroll linear infinite; }
        .rss-zone:hover .rss-scroll { animation-play-state: paused; }
      `}</style>

      <RevealSection className="overflow-hidden bg-[#f4f9f7] py-14 sm:py-20">
        {/* header — full left-align inside the same container max-width */}
        <div className="mx-auto mb-10 max-w-[72rem] px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-32px" }}
            transition={{ duration: 0.5, ease: easeOutSmooth }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5a8f7a]">
              {t("review_showcase_eyebrow")}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-[#1a3c34] sm:text-3xl">
                {t("review_showcase_title")}
              </h2>
              <span className="rounded-full bg-[#1a3c34]/8 px-2.5 py-1 text-[11px] font-semibold text-[#1a3c34]">
                {t("review_showcase_count", { count: reviews.length })}
              </span>
            </div>
          </motion.div>
        </div>

        {/* single-row infinite marquee — hover anywhere to pause */}
        <div className="rss-zone relative">
          {/* edge gradient fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#f4f9f7] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#f4f9f7] to-transparent" />

          <MarqueeTrack reviews={reviews} duration={60} />
        </div>
      </RevealSection>
    </>
  );
}
