"use client";

import { RevealSection, easeOutSmooth } from "./RevealSection";
import { Button } from "@heroui/react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight, Coins, Gift, ShoppingBag, Zap, TrendingUp, ChevronRight } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { useActiveCampaignQuery } from "@/services/campaign/hooks";
import type { ActiveCampaign } from "@/services/campaign/api";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
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

function useCountdown(endAt: string) {
  const calc = () => {
    const diff = Math.max(0, new Date(endAt).getTime() - Date.now());
    return {
      days:    Math.floor(diff / 86_400_000),
      hours:   Math.floor((diff % 86_400_000) / 3_600_000),
      minutes: Math.floor((diff % 3_600_000)  / 60_000),
      seconds: Math.floor((diff % 60_000)      / 1_000),
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
        className="text-2xl font-black tabular-nums text-white leading-none"
        transformTiming={{ duration: 400, easing: "ease-out" }}
        spinTiming={{ duration: 400, easing: "ease-in-out" }}
      />
      <span className="text-[9px] font-semibold uppercase tracking-widest text-white/45">{label}</span>
    </div>
  );
}

function PromoBannerInner({ campaign }: { campaign: ActiveCampaign }) {
  const router = useRouter();
  const countdown = useCountdown(campaign.endAt);

  const campaignPct = parseFloat(campaign.earnPercent);
  const basePct     = parseFloat(campaign.baseEarnPercent);
  const bonusPct    = campaignPct - basePct;

  return (
    <RevealSection className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="container mx-auto">
        <div className="relative overflow-hidden rounded-[var(--radius-kun-2xl)] bg-[#1a3c34] shadow-[0_24px_80px_-24px_rgba(26,60,52,0.6)]">

          <div className="pointer-events-none absolute -left-32 -top-32 size-[480px] rounded-full bg-[#2d6b5a]/40 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-20 right-12 size-72 rounded-full bg-[#99d6b3]/10 blur-3xl" aria-hidden />

          <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center md:gap-10 lg:p-14">

            {/* ─── Left copy ─── */}
            <motion.div
              className="flex flex-col gap-6"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-48px" }}
              transition={{ duration: 0.75, ease: easeOutSmooth, delay: 0.06 }}
            >
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#99d6b3]/15 px-4 py-1.5 text-[11px] font-semibold text-[#99d6b3] ring-1 ring-[#99d6b3]/30">
                <Zap className="size-3 fill-[#99d6b3] text-[#99d6b3]" />
                Chiến dịch tích điểm · Giới hạn thời gian
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5a8f7a]">
                  Ưu đãi điểm thưởng
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-[1.15] tracking-tight text-white sm:text-[1.75rem] lg:text-[2rem]">
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

              {/* Flow steps */}
              <div className="flex flex-wrap items-start gap-x-2 gap-y-3">
                {[
                  { icon: ShoppingBag, label: "Đặt hàng" },
                  { icon: TrendingUp,  label: "Tích điểm" },
                  { icon: Coins,       label: "Đổi voucher" },
                  { icon: Gift,        label: "Giảm giá" },
                ].map(({ icon: Icon, label }, i) => (
                  <div key={label} className="flex items-center gap-1.5">
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

              {/* CTA + countdown */}
              <div className="flex flex-col gap-4">
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
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 shrink-0">
                      Kết thúc sau
                    </span>
                    <div className="flex items-end gap-2">
                      {countdown.days > 0 && (
                        <>
                          <CountdownUnit value={countdown.days} label="ngày" />
                          <span className="pb-4 text-white/25 text-lg">:</span>
                        </>
                      )}
                      <CountdownUnit value={countdown.hours} label="giờ" />
                      <span className="pb-4 text-white/25 text-lg">:</span>
                      <CountdownUnit value={countdown.minutes} label="phút" />
                      <span className="pb-4 text-white/25 text-lg">:</span>
                      <CountdownUnit value={countdown.seconds} label="giây" />
                    </div>
                    <span className="hidden sm:block sm:ml-auto text-[10px] text-white/25 shrink-0">
                      HSD: {fmtDate(campaign.endAt)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ─── Right badge ─── */}
            <motion.div
              className="hidden md:flex items-center justify-center md:pr-2 lg:pr-4"
              initial={{ opacity: 0, scale: 0.78 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-48px" }}
              transition={{ duration: 0.9, ease: easeOutSmooth, delay: 0.22 }}
            >
              <div className="relative flex flex-col items-center gap-4">
                <motion.div
                  className="absolute size-52 rounded-full bg-[#99d6b3]/12 md:size-60"
                  animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.18, 0.5] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute size-40 rounded-full bg-[#99d6b3]/18 md:size-48"
                  animate={{ scale: [1, 1.09, 1], opacity: [0.65, 0.28, 0.65] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                />

                <div className="relative flex size-44 flex-col items-center justify-center rounded-full border-2 border-[#99d6b3]/35 bg-gradient-to-b from-[#2d6b5a] to-[#1f4f3e] shadow-[0_0_80px_rgba(153,214,179,0.22)] md:size-52">
                  <TrendingUp className="mb-1 size-5 text-[#99d6b3]/60" />
                  <span className="text-5xl font-black leading-none tracking-tight text-white md:text-6xl">
                    {campaignPct}%
                  </span>
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#99d6b3]">
                    điểm tích lũy
                  </span>
                </div>

                <div className="flex flex-col items-center rounded-xl border border-[#99d6b3]/20 bg-white/6 px-5 py-2.5 text-center">
                  <p className="text-[10px] text-white/40">Thêm so với thường</p>
                  <p className="text-lg font-black text-[#99d6b3]">
                    +<AnimatedCount target={bonusPct} />% điểm
                  </p>
                  <p className="text-[10px] text-white/30">→ đổi voucher giảm giá</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </RevealSection>
  );
}

export function PromoBanner() {
  const { data: campaign, isLoading } = useActiveCampaignQuery();
  if (isLoading || !campaign) return null;
  return <PromoBannerInner campaign={campaign} />;
}
