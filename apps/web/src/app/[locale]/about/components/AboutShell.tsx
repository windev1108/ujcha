"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Coffee, Heart, Leaf, Sparkles } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

const FADE_UP = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-48px" } as const,
};

const STATS_VALUES = [
  { value: "3+",    key: "stat_years_exp" },
  { value: "50+",   key: "stat_products"  },
  { value: "1000+", key: "stat_customers" },
];

export function AboutShell() {
  const t = useTranslations();

  const VALUES = [
    {
      icon: Leaf,
      eyebrow:  t("value_handcraft_eyebrow"),
      headline: t("value_handcraft_headline"),
      body:     t("value_handcraft_body"),
    },
    {
      icon: Sparkles,
      eyebrow:  t("value_curated_eyebrow"),
      headline: t("value_curated_headline"),
      body:     t("value_curated_body"),
    },
    {
      icon: Heart,
      eyebrow:  t("value_mindful_eyebrow"),
      headline: t("value_mindful_headline"),
      body:     t("value_mindful_body"),
    },
  ];

  const STORY_PARAGRAPHS = [
    t("about_story_p1"),
    t("about_story_p2"),
    t("about_story_p3"),
  ];

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-2xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45"
            >
              {t("about")}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              {t("about_hero_h1_1")}
              <br />
              <span className="text-[#99d6b3]">{t("about_hero_h1_2")}</span>{" "}{t("about_hero_h1_3")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
            >
              {t("about_hero_desc")}
            </motion.p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full" aria-hidden>
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Brand story ── */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-[72rem]">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
            <motion.div {...FADE_UP} transition={{ duration: 0.6 }}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                {t("about_story_eyebrow")}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {t("about_story_h2_1")}
                <br />
                {t("about_story_h2_2")}
              </h2>
            </motion.div>

            <div className="flex flex-col gap-5 text-sm leading-relaxed text-foreground/70 sm:text-base">
              {STORY_PARAGRAPHS.map((para, i) => (
                <motion.p key={i} {...FADE_UP} transition={{ duration: 0.5, delay: i * 0.1 }}>
                  {para}
                </motion.p>
              ))}
            </div>
          </div>

          <motion.div
            {...FADE_UP} transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-14 flex items-center gap-4"
          >
            <div className="h-px flex-1 bg-black/[0.06]" />
            <Leaf className="size-4 text-kun-sage" />
            <div className="h-px flex-1 bg-black/[0.06]" />
          </motion.div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="bg-surface-soft px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-[72rem]">
          <motion.div {...FADE_UP} transition={{ duration: 0.6 }} className="mb-12 text-center">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t("about_values_eyebrow")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("about_values_h2")}
            </h2>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-3">
            {VALUES.map(({ icon: Icon, eyebrow, headline, body }, i) => (
              <motion.div
                key={eyebrow}
                {...FADE_UP}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-3xl border border-black/[0.06] bg-white p-6 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-7"
              >
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-kun-primary/[0.08]">
                  <Icon className="size-5 text-kun-primary" />
                </span>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{eyebrow}</p>
                <h3 className="mb-3 text-base font-semibold tracking-tight text-foreground">{headline}</h3>
                <p className="text-sm leading-relaxed text-foreground/65">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-[72rem]">
          <div className="grid grid-cols-3 divide-x divide-black/[0.06]">
            {STATS_VALUES.map(({ value, key }, i) => (
              <motion.div
                key={key}
                {...FADE_UP}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="px-4 text-center sm:px-10"
              >
                <p className="text-4xl font-bold tabular-nums tracking-tight text-kun-primary sm:text-5xl">{value}</p>
                <p className="mt-2 text-xs font-medium text-muted sm:text-sm">
                  {t(key as Parameters<typeof t>[0])}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 pb-24 pt-2 sm:pb-32">
        <div className="mx-auto max-w-[72rem]">
          <motion.div
            {...FADE_UP} transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-kun-primary px-8 py-14 text-center sm:px-16 sm:py-20"
          >
            <svg
              className="pointer-events-none absolute right-0 top-0 opacity-[0.08]"
              width="300" height="260" viewBox="0 0 300 260" fill="none" aria-hidden
            >
              <circle cx="240" cy="60" r="140" fill="white" />
            </svg>
            <div className="relative">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                {t("about_cta_eyebrow")}
              </p>
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {t("about_cta_h2")}
              </h2>
              <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-white/65 sm:text-base">
                {t("about_cta_desc")}
              </p>
              <Link
                href={ROUTES.MENU}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-kun-primary transition-opacity hover:opacity-90"
              >
                <Coffee className="size-4" />
                {t("view_menu")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
