"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Star, Quote, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fetchPinnedFeedbacks, type PinnedFeedback } from "@/services/feedback/api";
import { RevealSection, easeOutSmooth } from "./RevealSection";

// 300px card + 16px gap = 316px per slot; ~63px/s feels calm
const CARD_SLOT_PX = 316;
const SPEED_PX_PER_S = 63;

function ReviewCard({ review }: { review: PinnedFeedback }) {
  const t = useTranslations();
  const locale = useLocale();
  const isGrab = review.externalId?.startsWith("grab:");
  const date = new Date(review.createdAt).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  const card = (
    <div className="group relative flex h-[260px] w-[300px] shrink-0 select-none flex-col overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_4px_20px_-6px_rgba(26,60,52,0.09)] transition-shadow duration-300 hover:shadow-[0_10px_36px_-6px_rgba(26,60,52,0.18)]">
      <Quote className="absolute right-4 top-4 size-10 rotate-180 text-[#1a3c34]/[0.05]" />

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
            isGrab ? "bg-[#00b14f]/10 text-[#00b14f]" : "bg-[#1a3c34]/8 text-[#1a3c34]"
          }`}
        >
          {isGrab ? "GrabFood" : "UjCha"}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 shrink-0 text-sm leading-relaxed text-foreground/65">
        {review.content}
      </p>

      <div className="flex-1" />

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

function MarqueeRow({
  reviews,
  direction,
  duration,
  phaseOffsetS = 0,
}: {
  reviews: PinnedFeedback[];
  direction: "left" | "right";
  duration: number;
  phaseOffsetS?: number;
}) {
  const items = [...reviews, ...reviews, ...reviews];
  return (
    <div className="overflow-hidden">
      <div
        className={direction === "left" ? "rss-track-left" : "rss-track-right"}
        style={{
          animationDuration: `${duration}s`,
          animationDelay: phaseOffsetS ? `${phaseOffsetS}s` : undefined,
        }}
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

  // Both rows use ALL reviews so each row has enough cards to fill any viewport.
  // N × 316px must exceed the widest viewport — ≥6 reviews → 1896px (covers ≤1600px),
  // ≥7 → 2212px (covers ≤1920px). Row 2 starts half a cycle ahead to stagger visible cards.
  const showTwoRows = reviews.length >= 6;
  const duration = Math.round((reviews.length * CARD_SLOT_PX) / SPEED_PX_PER_S);

  return (
    <>
      <style>{`
        @keyframes rss-left {
          to { transform: translateX(-33.3333%); }
        }
        @keyframes rss-right {
          from { transform: translateX(-33.3333%); }
          to   { transform: translateX(0); }
        }
        .rss-track-left {
          display: flex;
          width: max-content;
          gap: 16px;
          padding-right: 16px;
          animation: rss-left linear infinite;
        }
        .rss-track-right {
          display: flex;
          width: max-content;
          gap: 16px;
          padding-right: 16px;
          animation: rss-right linear infinite;
        }
        .rss-zone:hover .rss-track-left,
        .rss-zone:hover .rss-track-right {
          animation-play-state: paused;
        }
      `}</style>

      <RevealSection className="overflow-hidden bg-[#f4f9f7] py-14 sm:py-20">
        {/* header */}
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

        {/* snake marquee — left edge and right edge gradients sell the "turn" illusion */}
        <div className="rss-zone relative flex flex-col gap-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#f4f9f7] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#f4f9f7] to-transparent" />

          <MarqueeRow reviews={reviews} direction="left" duration={duration} />
          {showTwoRows && (
            <MarqueeRow
              reviews={reviews}
              direction="right"
              duration={duration}
              phaseOffsetS={-(duration / 2)}
            />
          )}
        </div>
      </RevealSection>
    </>
  );
}
