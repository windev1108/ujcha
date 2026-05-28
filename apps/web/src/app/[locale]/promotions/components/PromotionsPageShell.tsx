"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Coins,
  Gift,
  ShoppingBag,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Button } from "@heroui/react";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { usePromotionsQuery } from "@/services/promotions/hooks";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import type { ActiveCampaign } from "@/services/promotions/api";

const EXAMPLE_ORDER = 200_000;

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function useCountdown(endAt: string) {
  const calc = () => {
    const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
    return {
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff % 86_400_000) / 3_600_000),
      minutes: Math.floor((diff % 3_600_000) / 60_000),
      seconds: Math.floor((diff % 60_000) / 1_000),
      expired: diff === 0,
    };
  };
  const [cd, setCd] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setCd(calc()), 1_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt]);
  return cd;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <NumberFlow
        value={value}
        format={{ minimumIntegerDigits: 2 }}
        className="text-xl font-black tabular-nums text-white leading-none"
        transformTiming={{ duration: 400, easing: "ease-out" }}
        spinTiming={{ duration: 400, easing: "ease-in-out" }}
      />
      <span className="text-[9px] font-semibold uppercase tracking-widest text-white/45">{label}</span>
    </div>
  );
}

function AnimatedCount({ target, suffix = "" }: { target: number; suffix?: string }) {
  const val = useMotionValue(0);
  const display = useTransform(val, (v) => fmt(v) + suffix);
  useEffect(() => {
    const ctrl = animate(val, target, { duration: 1.6, ease: "easeOut", delay: 0.4 });
    return ctrl.stop;
  }, [val, target]);
  return <motion.span>{display}</motion.span>;
}

function CampaignBanner({ campaign }: { campaign: ActiveCampaign }) {
  const router = useRouter();
  const countdown = useCountdown(campaign.endAt);
  const campaignPct = parseFloat(campaign.earnPercent);
  const basePct = parseFloat(campaign.baseEarnPercent);
  const pointRate = campaign.pointRate;
  const bonusPct = campaignPct - basePct;

  const basePoints = Math.round(EXAMPLE_ORDER * basePct / 100 / pointRate);
  const campaignPoints = Math.round(EXAMPLE_ORDER * campaignPct / 100 / pointRate);
  const bonusPoints = campaignPoints - basePoints;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: 0.4, ease: easeOutSmooth }}
      className="relative overflow-hidden rounded-3xl bg-[#1a3c34] shadow-[0_24px_80px_-24px_rgba(26,60,52,0.5)]"
    >
      <div className="pointer-events-none absolute -left-32 -top-32 size-[480px] rounded-full bg-[#2d6b5a]/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-20 right-12 size-72 rounded-full bg-[#99d6b3]/10 blur-3xl" aria-hidden />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#99d6b3]/15 px-4 py-1.5 text-[11px] font-semibold text-[#99d6b3] ring-1 ring-[#99d6b3]/30">
          <Zap className="size-3 fill-[#99d6b3] text-[#99d6b3]" />
          Chiến dịch tích điểm · Giới hạn thời gian
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5a8f7a]">
            Ưu đãi điểm thưởng
          </p>
          <h2 className="mt-2 text-2xl font-bold leading-[1.15] tracking-tight text-white sm:text-[1.75rem]">
            {campaign.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/6 px-5 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Thông thường</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white/60">{basePct}%</p>
            <p className="text-[10px] text-white/35">/ đơn hàng</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <ChevronRight className="size-5 text-[#99d6b3]/60" />
            <span className="rounded-full bg-[#99d6b3]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#99d6b3]">
              +{bonusPct}%
            </span>
          </div>

          <div className="flex flex-col items-center rounded-2xl border border-[#99d6b3]/30 bg-[#99d6b3]/10 px-5 py-3.5 ring-1 ring-[#99d6b3]/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#99d6b3]/70">Trong chiến dịch</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{campaignPct}%</p>
            <p className="text-[10px] text-[#99d6b3]/60">/ đơn hàng</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[
            { icon: ShoppingBag, label: "Đặt hàng" },
            { icon: TrendingUp, label: "Tích điểm" },
            { icon: Coins, label: "Đổi voucher" },
            { icon: Gift, label: "Giảm giá" },
          ].map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-white/10">
                  <Icon className="size-3.5 text-[#99d6b3]" />
                </div>
                <span className="text-[9px] font-semibold text-white/50">{label}</span>
              </div>
              {i < 3 && <ChevronRight className="mb-3.5 size-3.5 shrink-0 text-white/20" />}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => router.push(ROUTES.MENU)}
              className="h-11 rounded-full bg-white px-6 font-semibold text-[#1a3c34] shadow-lg transition-opacity hover:opacity-90"
            >
              <ShoppingBag className="mr-1.5 size-4" />
              Đặt hàng tích điểm
            </Button>
            <Button
              onClick={() => router.push(ROUTES.REWARDS)}
              className="h-11 rounded-full border border-[#99d6b3]/40 bg-[#99d6b3]/15 px-6 font-semibold text-[#99d6b3] transition-opacity hover:opacity-90"
            >
              <Coins className="mr-1.5 size-4" />
              Đổi điểm lấy voucher
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </div>

          {!countdown.expired && (
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Kết thúc sau
              </span>
              <div className="flex items-end gap-2.5">
                {countdown.days > 0 && (
                  <>
                    <CountdownUnit value={countdown.days} label="ngày" />
                    <span className="pb-4 text-base text-white/25">:</span>
                  </>
                )}
                <CountdownUnit value={countdown.hours} label="giờ" />
                <span className="pb-4 text-base text-white/25">:</span>
                <CountdownUnit value={countdown.minutes} label="phút" />
                <span className="pb-4 text-base text-white/25">:</span>
                <CountdownUnit value={countdown.seconds} label="giây" />
              </div>
              <span className="hidden shrink-0 text-[10px] text-white/25 sm:ml-auto sm:block">
                HSD: {fmtDate(campaign.endAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PointEarnStrip({
  earnPercent,
  pointRate,
  onGoRewards,
}: {
  earnPercent: string;
  pointRate: number;
  onGoRewards: () => void;
}) {
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
            Tích điểm thường xuyên
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            Mỗi đơn hoàn thành tích{" "}
            <span className="font-bold text-[#1a3c34]">{earnPercent}%</span>
            {" "}giá trị đơn thành điểm UjCha
          </p>
          <p className="mt-0.5 text-xs text-muted">
            1 điểm = {pointRate.toLocaleString("vi-VN")}đ giá trị voucher · đổi tại trang Phần thưởng
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-soft px-4 py-3">
        {[
          { icon: ShoppingBag, label: "Đặt hàng", sub: "Hoàn thành đơn" },
          { icon: TrendingUp, label: "Tích điểm", sub: `${earnPercent}% giá trị` },
          { icon: Coins, label: "Đổi voucher", sub: "Tại trang Phần thưởng" },
          { icon: Gift, label: "Dùng voucher", sub: "Khi thanh toán" },
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
        Xem danh mục đổi điểm
        <ArrowRight className="size-4" />
      </button>
    </motion.div>
  );
}

function EmptyState() {
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Ưu đãi</p>
      <p className="mt-2 text-xl font-bold text-foreground">Chưa có khuyến mãi</p>
      <p className="mt-2 max-w-[260px] text-sm text-muted">
        Không có chiến dịch nào đang chạy lúc này. Hãy quay lại sau!
      </p>
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
  const { data, isLoading } = usePromotionsQuery();

  const hasContent = !isLoading && data && (data.campaign !== null || data.pointConfig !== null);
  const isEmpty = !isLoading && data && !data.campaign && !data.pointConfig;

  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
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
              Ưu đãi
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              Khuyến mãi
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
            >
              Chiến dịch tích điểm, ưu đãi giới hạn và các phần thưởng dành riêng cho bạn.
            </motion.p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full" aria-hidden>
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── Content ── */}
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
              {data!.campaign && <CampaignBanner campaign={data!.campaign} />}
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
