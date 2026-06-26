"use client";

import { easeOutSmooth, revealTransition } from "./RevealSection";
import { MEDIA } from "@/lib/media";
import { Button } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "../../../../i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronRight, Star, Clock, Leaf, ArrowRight, ArrowUpRight } from "lucide-react";
import { useCategoriesQuery } from "@/services/category/hooks";
import { useTranslations } from "next-intl";

const CAROUSEL_INTERVAL_MS = 5000;
const stagger = 0.1;

// Cubic bezier cho clip-path wipe — cảm giác cinematic snap
const WIPE_EASE = [0.77, 0, 0.18, 1] as const;

const FALLBACK_SLIDE = { src: MEDIA.hero, alt: "UjCha" };

export function Hero() {
  const router = useRouter();
  const t = useTranslations();
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const { data: categories, isLoading: categoriesLoading } = useCategoriesQuery();

  const trustPills = [
    { icon: <Star className="size-3 fill-[#c9a227] text-[#c9a227]" />, text: t("trust_rating") },
    { icon: <Clock className="size-3 text-[#99d6b3]" />, text: t("trust_delivery") },
    { icon: <Leaf className="size-3 text-[#99d6b3]" />, text: t("trust_natural") },
  ];

  const slides = useMemo(() => {
    const catSlides = (categories ?? [])
      .filter((c) => c.thumbnail)
      .map((c) => ({ src: c.thumbnail!, alt: c.name }));
    return catSlides.length > 0 ? catSlides : [FALLBACK_SLIDE];
  }, [categories]);

  useEffect(() => { setActive(0); }, [slides]);

  useEffect(() => {
    if (reduceMotion || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion, slides]);

  return (
    <motion.section
      className="px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-6"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={revealTransition}
    >
      <div className="container relative mx-auto min-h-[220px] overflow-hidden rounded-[var(--radius-kun-2xl)] border border-black/[0.06] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.4)] sm:min-h-[440px] md:min-h-[560px] lg:min-h-[720px]">

        {/* Skeleton */}
        {categoriesLoading && (
          <div className="absolute inset-0 animate-pulse bg-surface-card" />
        )}

        {/* ─── Carousel — AnimatePresence + clipPath wipe ─── */}
        {!categoriesLoading && (
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={active}
              className="absolute inset-0"
              initial={reduceMotion ? { opacity: 0 } : { clipPath: "inset(0 0 0 100%)" }}
              animate={reduceMotion ? { opacity: 1 } : { clipPath: "inset(0 0 0 0%)" }}
              exit={{ opacity: 0 }}
              transition={{
                clipPath: { duration: 0.88, ease: WIPE_EASE },
                opacity: { duration: 0.3 },
              }}
            >
              {/* Ken Burns inner */}
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 1 }}
                animate={{ scale: 1.07 }}
                transition={{ duration: (CAROUSEL_INTERVAL_MS + 1500) / 1000, ease: "linear" }}
              >
                <Image
                  src={slides[active]?.src ?? FALLBACK_SLIDE.src}
                  alt={slides[active]?.alt ?? "UjCha"}
                  fill
                  quality={90}
                  className="object-cover object-center"
                  sizes="(min-width: 1024px) 72rem, 100vw"
                  priority
                  unoptimized
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── Gradient layers ─── */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/82 via-black/52 to-black/12 md:from-black/74 md:via-black/40 md:to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/72 to-transparent"
          aria-hidden
        />
        {/* Radial forest spotlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 58% 72% at 16% 52%, rgba(26,60,52,0.45) 0%, transparent 66%)" }}
          aria-hidden
        />

        {/* ─── Large editorial number ─── */}
        {slides.length > 1 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`num-${active}`}
              className="pointer-events-none absolute bottom-0 right-4 select-none font-black leading-none tabular-nums text-white sm:right-8"
              style={{ fontSize: "clamp(80px, 18vw, 220px)", opacity: 0.045 }}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 0.045 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.4, ease: easeOutSmooth }}
            >
              {String(active + 1).padStart(2, "0")}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── Vertical brand label (desktop) ─── */}
        <div
          className="pointer-events-none absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 rotate-90 select-none text-[9px] font-bold uppercase tracking-[0.4em] text-white/22 lg:block"
          aria-hidden
        >
          UjCha · Café
        </div>

        {/* ─── Content ─── */}
        <div className="relative z-10 flex min-h-[220px] flex-col justify-center px-5 py-8 sm:min-h-[440px] sm:px-10 sm:py-14 md:min-h-[560px] md:px-14 lg:min-h-[720px] lg:px-16">
          <div className="max-w-[540px]">

            {/* Eyebrow */}
            <motion.div
              className="mb-4 inline-flex sm:mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: easeOutSmooth }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm sm:px-3.5 sm:py-1.5 sm:text-[11px]">
                <span className="relative flex size-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#99d6b3] opacity-70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#99d6b3]" />
                </span>
                {t("hero_eyebrow")}
                <span className="hidden h-3 w-px bg-white/20 sm:block" />
                <span className="hidden text-white/40 sm:inline">{t("trust_natural")}</span>
              </span>
            </motion.div>

            {/* Headline — blur+lift reveal */}
            <motion.h1
              className="text-[1.75rem] font-black leading-[1.05] tracking-[-0.02em] text-white sm:text-[3.2rem] lg:text-[3.8rem] xl:text-[4.4rem]"
              initial={{ opacity: 0, y: 36, filter: "blur(16px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, ease: easeOutSmooth, delay: stagger }}
            >
              {t("hero_headline")}
              <br />
              <span className="relative inline-block text-[#99d6b3]">
                Matcha.
                <motion.span
                  className="absolute -bottom-1 left-0 h-[2px] rounded-full bg-[#99d6b3]/55 sm:h-[3px]"
                  style={{ width: "100%" }}
                  initial={{ scaleX: 0, originX: "left" }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.8, ease: easeOutSmooth, delay: stagger * 5 }}
                />
              </span>
            </motion.h1>

            {/* Subline */}
            <motion.p
              className="mt-5 hidden max-w-xs text-[15px] leading-relaxed text-white/70 sm:block sm:text-base"
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: easeOutSmooth, delay: stagger * 2 }}
            >
              {t("hero_subline")}
            </motion.p>

            {/* Trust pills */}
            <motion.div
              className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2"
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: easeOutSmooth, delay: stagger * 2.8 }}
            >
              {trustPills.map(({ icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-medium text-white/75 ring-1 ring-white/10 backdrop-blur-sm sm:gap-1.5 sm:px-3 sm:py-1 sm:text-[11px]"
                >
                  {icon}
                  {text}
                </span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="mt-5 flex flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-3"
              initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.85, ease: easeOutSmooth, delay: stagger * 3.6 }}
            >
              {/* Primary — shimmer CTA */}
              <Button
                onClick={() => router.push(ROUTES.PRODUCTS)}
                className="relative h-10 overflow-hidden rounded-full bg-[#3d7568] px-5 text-sm font-bold text-white shadow-xl shadow-black/30 transition-all hover:bg-[#4a8a7d] hover:shadow-2xl hover:shadow-[#3d7568]/40 sm:h-12 sm:px-7 sm:text-[15px]"
              >
                {!reduceMotion && (
                  <motion.span
                    className="pointer-events-none absolute inset-0 -skew-x-[22deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ x: "-120%" }}
                    animate={{ x: "220%" }}
                    transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 5.5, ease: "linear", delay: 3 }}
                  />
                )}
                {t("explore_menu")}
                <ArrowRight className="ml-1.5 size-4" />
              </Button>

              {/* Secondary */}
              <Link
                href={ROUTES.PROMOTIONS}
                className="group inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-transparent px-4 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:border-white/32 hover:bg-white/10 sm:h-12 sm:px-5 sm:text-sm"
              >
                {t("view_promotions")}
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* ─── Bottom bar ─── */}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-5 pb-4 sm:px-10 sm:pb-5 md:px-14 lg:px-16">

            {/* Left: animated category chip */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`cat-${active}`}
                className="hidden sm:block"
                initial={{ opacity: 0, y: 6, x: -6 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.32, ease: easeOutSmooth }}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3.5 py-1.5 text-[11px] font-semibold text-white/72 backdrop-blur-md ring-1 ring-white/8">
                  <span className="size-[5px] rounded-full bg-[#99d6b3]" />
                  {slides[active]?.alt ?? ""}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Center: progress bars */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-[7px] sm:bottom-5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  aria-current={active === i ? "true" : undefined}
                  onClick={() => setActive(i)}
                  className="group relative h-[3px] overflow-hidden rounded-full bg-white/20 transition-[width,background] duration-500 hover:bg-white/35"
                  style={{ width: active === i ? 48 : 8 }}
                >
                  {active === i && !reduceMotion && (
                    <motion.div
                      key={active}
                      className="absolute inset-0 origin-left rounded-full bg-white"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: CAROUSEL_INTERVAL_MS / 1000, ease: "linear" }}
                    />
                  )}
                  {active === i && reduceMotion && (
                    <div className="absolute inset-0 rounded-full bg-white" />
                  )}
                </button>
              ))}
            </div>

            {/* Right: zero-padded Gen Z counter */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="font-mono text-xs font-bold tabular-nums text-white/70">
                {String(active + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-4 bg-white/25" />
              <span className="font-mono text-xs tabular-nums text-white/30">
                {String(slides.length).padStart(2, "0")}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
