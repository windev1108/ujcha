"use client";

import { easeOutSmooth, revealTransition } from "./RevealSection";
import { MEDIA } from "@/lib/media";
import { Button } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useRouter } from "../../../../i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronRight, ChevronDown, Star, Clock, Leaf, ArrowRight } from "lucide-react";
import { useCategoriesQuery } from "@/services/category/hooks";
import { useTranslations } from "next-intl";

const CAROUSEL_INTERVAL_MS = 5000;
const CROSSFADE_DURATION = 0.85;
const stagger = 0.12;

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

  // Build slide list from category thumbnails; fall back to single static image
  const slides = useMemo(() => {
    const catSlides = (categories ?? [])
      .filter((c) => c.thumbnail)
      .map((c) => ({ src: c.thumbnail!, alt: c.name }));
    return catSlides.length > 0 ? catSlides : [FALLBACK_SLIDE];
  }, [categories]);

  // Reset active index when slides change (e.g. categories finish loading)
  useEffect(() => {
    setActive(0);
  }, [slides]);

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
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={revealTransition}
    >
      <div className="container relative mx-auto min-h-[220px] overflow-hidden rounded-[var(--radius-kun-2xl)] border border-black/[0.06] shadow-[0_24px_72px_-24px_rgba(0,0,0,0.28)] sm:min-h-[440px] md:min-h-[540px] lg:min-h-[700px]">

        {/* Skeleton while categories are loading */}
        {categoriesLoading && (
          <div className="absolute inset-0 animate-pulse bg-surface-card" />
        )}

        {/* Carousel images */}
        {!categoriesLoading && slides.map((slide, i) => (
          <motion.div
            key={slide.src}
            className="absolute inset-0"
            initial={false}
            animate={{ opacity: active === i ? 1 : 0 }}
            transition={{ duration: CROSSFADE_DURATION, ease: easeOutSmooth }}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              quality={90}
              className="object-cover object-center"
              sizes="(min-width: 1024px) 72rem, 100vw"
              priority={i === 0}
              unoptimized
            />
          </motion.div>
        ))}

        {/* Layered gradients */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10 md:from-black/70 md:via-black/35 md:to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent"
          aria-hidden
        />

        {/* Content */}
        <div className="relative z-10 flex min-h-[220px] flex-col justify-center px-5 py-7 sm:min-h-[440px] sm:px-10 sm:py-14 md:min-h-[540px] md:px-14 lg:min-h-[700px] lg:px-16">
          <div className="max-w-xl">

            {/* Eyebrow badge */}
            <motion.div
              className="mb-3 inline-flex sm:mb-5"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: easeOutSmooth }}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-[11px]">
                <Leaf className="size-3 text-[#99d6b3]" />
                {t("hero_eyebrow")}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-[1.6rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: easeOutSmooth, delay: stagger }}
            >
              {t("hero_headline")}
              <br />
              <span className="text-[#99d6b3]">Matcha.</span>
            </motion.h1>

            {/* Subline — desktop only */}
            <motion.p
              className="mt-5 hidden max-w-sm text-[15px] leading-relaxed text-white/78 sm:block sm:text-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: easeOutSmooth, delay: stagger * 2 }}
            >
              {t("hero_subline")}
            </motion.p>

            {/* Trust pills — desktop only */}
            <motion.div
              className="mt-6 hidden flex-wrap gap-2 sm:flex"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: easeOutSmooth, delay: stagger * 2.6 }}
            >
              {trustPills.map(({ icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/88 ring-1 ring-white/12 backdrop-blur-sm"
                >
                  {icon}
                  {text}
                </span>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="mt-5 flex flex-wrap gap-2.5 sm:mt-8 sm:gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: easeOutSmooth, delay: stagger * 3.2 }}
            >
              <Button
                onClick={() => router.push(ROUTES.PRODUCTS)}
                className="h-9 rounded-full bg-[#3d7568] px-5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition-opacity hover:opacity-90 sm:h-11 sm:px-7"
              >
                {t("explore_menu")}
                <ArrowRight className="ml-1 size-3.5 sm:size-4" />
              </Button>
              <Link
                href={ROUTES.PROMOTIONS}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/22 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/17 sm:h-11 sm:gap-2 sm:px-6 sm:text-sm"
              >
                {t("view_promotions")}
                <ChevronRight className="size-3.5 sm:size-4" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Scroll down indicator — desktop only */}
        <motion.div
          className="absolute bottom-20 right-10 hidden flex-col items-center gap-2 lg:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {t("scroll_down")}
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="size-4 text-white/35" />
          </motion.div>
        </motion.div>

        {/* Slide name overlay (bottom-left) */}
        {slides.length > 1 && slides[active]?.alt && (
          <motion.div
            key={active}
            className="absolute bottom-10 left-7 z-20 hidden sm:block sm:left-10 md:left-14 lg:left-16"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOutSmooth }}
          >
            <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold text-white/70 backdrop-blur-sm">
              {slides[active].alt}
            </span>
          </motion.div>
        )}

        {/* Progress-bar carousel indicators */}
        <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={active === i ? "true" : undefined}
              onClick={() => setActive(i)}
              className="relative h-1 overflow-hidden rounded-full bg-white/25 transition-[width] duration-500"
              style={{ width: active === i ? 40 : 6 }}
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
      </div>
    </motion.section>
  );
}
