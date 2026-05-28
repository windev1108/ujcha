"use client";

import { RevealSection, revealTransition } from "./RevealSection";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useCategoriesQuery } from "@/services/category/hooks";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

// Rich dark palettes — cycles per category index
const PALETTES: readonly { bg: string; accent: string }[] = [
  { bg: "linear-gradient(135deg,#1a3c34 0%,#2d6b5a 100%)", accent: "#5a8f7a" },
  { bg: "linear-gradient(135deg,#3d2a0a 0%,#7a5214 100%)", accent: "#c9a227" },
  { bg: "linear-gradient(135deg,#0d2035 0%,#1a4060 100%)", accent: "#4a90b8" },
  { bg: "linear-gradient(135deg,#1a0d2e 0%,#3d1a6b 100%)", accent: "#9b72cf" },
  { bg: "linear-gradient(135deg,#2e1a0d 0%,#6b3a1a 100%)", accent: "#c07840" },
  { bg: "linear-gradient(135deg,#0d2e1a 0%,#1a6b3a 100%)", accent: "#40c07a" },
] as const;

function CategorySkeleton() {
  return (
    <div className="h-32 min-w-[156px] animate-pulse rounded-2xl bg-surface-secondary sm:min-w-0" />
  );
}

export function Categories() {
  const { data: categories, isLoading } = useCategoriesQuery();
  const t = useTranslations()
  if (!isLoading && (!categories || categories.length === 0)) return null;

  return (
    <RevealSection className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">
              {t('category')}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t('explore_menu')}
            </h2>
          </div>
          <Link
            href={ROUTES.PRODUCTS}
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-kun-primary transition-colors"
          >
            Xem tất cả
            <ChevronRight className="size-4" />
          </Link>
        </div>

        {/* Horizontal scroll on mobile, centered flex-wrap on sm+ */}
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-5 sm:px-0 sm:overflow-visible sm:pb-0">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
              <CategorySkeleton key={i} />
            ))
            : categories!.map((cat, index) => {
              const palette = PALETTES[index % PALETTES.length];
              const hasThumbnail = !!cat.thumbnail;
              return (
                <motion.div
                  key={cat.id}
                  className="shrink-0 snap-start min-w-[156px] sm:min-w-0 sm:w-[calc(33.333%-13.334px)] lg:w-[calc(25%-15px)] xl:w-[calc(20%-16px)]"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-48px" }}
                  transition={{ ...revealTransition, delay: index * 0.06 }}
                >
                  <Link
                    href={`${ROUTES.PRODUCTS}?category=${cat.slug}`}
                    className="group relative flex h-36 flex-col justify-between overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.025] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kun-primary sm:h-40"
                    style={hasThumbnail ? undefined : { background: palette.bg }}
                  >
                    {hasThumbnail && (
                      <>
                        <Image
                          src={cat.thumbnail!}
                          alt={cat.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 156px"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
                      </>
                    )}

                    {/* Top row: badge + arrow */}
                    <div className="relative flex items-center justify-between">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: "rgba(255,255,255,0.15)",
                          color: hasThumbnail ? "rgba(255,255,255,0.85)" : palette.accent,
                        }}
                      >
                        {cat._count.products} {t('products')}
                      </span>
                      <ChevronRight
                        className="size-3.5 text-white/30 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/60"
                      />
                    </div>

                    {/* Category name */}
                    <div className="relative">
                      <p className="text-base font-bold leading-tight text-white">
                        {cat.name}
                      </p>
                      <div
                        className="mt-1 h-0.5 w-6 rounded-full opacity-50 transition-all duration-300 group-hover:w-10 group-hover:opacity-100"
                        style={{ background: hasThumbnail ? "rgba(255,255,255,0.7)" : palette.accent }}
                      />
                    </div>

                    {/* Decorative orb — only when no photo */}
                    {!hasThumbnail && (
                      <div
                        className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-20 blur-xl"
                        style={{ background: palette.accent }}
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
        </div>

        {/* Mobile "Xem tất cả" */}
        <div className="mt-4 flex justify-center sm:hidden">
          <Link
            href={ROUTES.PRODUCTS}
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-kun-primary transition-colors"
          >
            Xem tất cả
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </RevealSection>
  );
}
