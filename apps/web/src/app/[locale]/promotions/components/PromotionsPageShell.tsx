"use client";

import { motion } from "motion/react";
import { ArrowRight, ChevronRight, Coins, Gift, ShoppingBag, Tag, TrendingUp } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { usePromotionsQuery } from "@/services/promotions/hooks";
import { useTranslations } from "next-intl";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import { CampaignBannerCard } from "@/components/campaign/CampaignBannerCard";

function PointEarnStrip({
  earnPercent,
  pointRate,
  onGoRewards,
}: {
  earnPercent: string;
  pointRate: number;
  onGoRewards: () => void;
}) {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: 0.35, ease: easeOutSmooth, delay: 0.08 }}
      className="rounded-3xl border border-black/6 bg-white p-5"
    >
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50">
          <TrendingUp className="size-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {t("earn_points_regularly")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {t("earn_per_order", { pct: earnPercent })}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {t("point_value", { rate: pointRate.toLocaleString("vi-VN") })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-soft px-4 py-3">
        {[
          { icon: ShoppingBag, label: t("order"), sub: t("complete_order") },
          { icon: TrendingUp, label: t("accumulate_points"), sub: `${earnPercent}%` },
          { icon: Coins, label: t("exchange_vouchers"), sub: t("at_rewards_page") },
          { icon: Gift, label: t("use_voucher_label"), sub: t("at_checkout") },
        ].map(({ icon: Icon, label, sub }, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white shadow-sm">
                <Icon className="size-3.5 text-[#1a3c34]" />
              </div>
              <p className="text-[10px] font-semibold text-foreground">{label}</p>
              <p className="hidden text-[9px] text-muted sm:block">{sub}</p>
            </div>
            {i < 3 && <ChevronRight className="mb-4 size-3.5 shrink-0 text-foreground/20" />}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGoRewards}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Coins className="size-4" />
        {t("view_rewards_catalog")}
        <ArrowRight className="size-4" />
      </button>
    </motion.div>
  );
}

function EmptyState() {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutSmooth }}
        className="mb-5 flex size-20 items-center justify-center rounded-full bg-surface-card"
      >
        <Tag className="size-9 text-foreground/25" />
      </motion.div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("offers")}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{t("no_promotions")}</p>
      <p className="mt-2 max-w-[260px] text-sm text-muted">{t("no_promotions_desc")}</p>
    </div>
  );
}

function SkeletonBanner() {
  return <div className="h-[420px] animate-pulse rounded-3xl bg-surface-card" />;
}

function SkeletonStrip() {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-5">
      <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-surface-card" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-surface-card" />
        <div className="h-4 w-3/4 animate-pulse rounded-lg bg-surface-card" />
      </div>
    </div>
  );
}

export function PromotionsPageShell() {
  const router = useRouter();
  const t = useTranslations();
  const { data, isLoading } = usePromotionsQuery();

  const hasContent = !isLoading && data && (data.campaign !== null || data.pointConfig !== null);
  const isEmpty = !isLoading && data && !data.campaign && !data.pointConfig;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-2xl text-center">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45"
            >
              {t("offers")}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              {t("promotions")}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
            >
              {t("promotions_desc")}
            </motion.p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full" aria-hidden>
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Content */}
      <div className="bg-white px-5 pb-16">
        <div className="mx-auto max-w-[72rem] pt-8">
          {isLoading && (
            <div className="space-y-4">
              <SkeletonBanner />
              <SkeletonStrip />
            </div>
          )}

          {isEmpty && <EmptyState />}

          {hasContent && (
            <div className="space-y-4">
              {data!.campaign && <CampaignBannerCard campaign={data!.campaign} />}
              {data!.pointConfig && (
                <PointEarnStrip
                  earnPercent={data!.pointConfig.earnPercent}
                  pointRate={data!.pointConfig.pointRate}
                  onGoRewards={() => router.push(ROUTES.REWARDS)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
