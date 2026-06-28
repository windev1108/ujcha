"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  ArrowRight, ChevronRight, Loader2,
  PauseCircle, Share2, ShoppingBag, Sparkles, Timer, Truck, Users, Zap,
} from "lucide-react";
import { Button } from "@heroui/react";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import { fetchGroupOrderConfig, type GroupDiscountTier } from "@/services/group-order/api";
import { fetchMyGroupOrderSessions } from "@/services/group-order/api";
import { useTranslations } from "next-intl";
import { CreateGroupOrderModal } from "@/components/group-order/CreateGroupOrderModal";
import { usePublicStoreLocationQuery } from "@/services/store/hooks";
import { minutesToTime } from "@/components/layout/Footer";
import { toast } from "sonner";

// ─── Animated counter ──────────────────────────────────────────────────────────

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const duration = 1000;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - t, 3)) * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);
  return <span ref={ref} className="tabular-nums">{val}{suffix}</span>;
}

// ─── Discount tier card ────────────────────────────────────────────────────────

function DiscountTierCard({ tier, index, isMax, isActive, activeCount }: {
  tier: GroupDiscountTier; index: number; isMax: boolean; isActive: boolean; activeCount: number;
}) {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }} transition={{ delay: index * 0.08 }}
      className={`relative flex items-center gap-4 overflow-hidden rounded-2xl border px-5 py-4 transition-all ${isMax ? "border-[#1a3c34]/25 bg-gradient-to-r from-[#f0faf6] to-white shadow-[0_4px_20px_-8px_rgba(26,60,52,0.15)]"
        : isActive ? "border-[#1a3c34]/15 bg-[#f7fcfa]" : "border-black/6 bg-white"
        }`}
    >
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isMax ? "bg-[#1a3c34]/12" : "bg-black/4"}`}>
        {index === 0 ? <Users className={`size-5 ${isMax ? "text-[#1a3c34]" : "text-foreground/50"}`} />
          : index === 1 ? <Sparkles className={`size-5 ${isMax ? "text-[#1a3c34]" : "text-foreground/50"}`} />
            : <Zap className={`size-5 ${isMax ? "text-[#1a3c34]" : "text-foreground/50"}`} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{t("tier_min_members", { count: tier.minParticipants })}</p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {activeCount >= tier.minParticipants
            ? t("tier_active")
            : t("tier_need_more", { count: tier.minParticipants - activeCount })}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className={`text-2xl font-bold tabular-nums ${isMax ? "text-[#1a3c34]" : "text-foreground/70"}`}>
          -{tier.discountPercent}%
        </span>
        {isMax && (
          <span className="mt-0.5 rounded-full bg-[#1a3c34] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            {t("best")}
          </span>
        )}
      </div>
      {isActive && <div className="absolute left-0 top-0 h-full w-1 rounded-r bg-[#1a3c34]/30" />}
    </motion.div>
  );
}

// ─── Main shell ────────────────────────────────────────────────────────────────

function fmtExpiry(minutes: number, locale: string): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60;
    return locale === "vi" ? `${h} giờ` : `${h} hour${h !== 1 ? "s" : ""}`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return locale === "vi" ? `${h} giờ ${m} phút` : `${h}h ${m}m`;
  }
  return locale === "vi" ? `${minutes} phút` : `${minutes} min`;
}

export function GroupOrderLandingShell() {
  const t = useTranslations();
  const router = useRouter();
  const locale = typeof window !== "undefined"
    ? (document.documentElement.lang || "vi")
    : "vi";
  const accessToken = useAuthStore((s) => s.accessToken);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { data: storeLocation } = usePublicStoreLocationQuery();

  useEffect(() => {
    if (!accessToken) return;
    fetchMyGroupOrderSessions()
      .then((list) => setHasActiveSession(list.length > 0))
      .catch(() => { });
  }, [accessToken]);

  const handleCreatePress = () => {
    if (!isEnabled) return;
    if (!accessToken) {
      router.push(`${ROUTES.LOGIN}?redirect=/group-order`);
      return;
    }
    const dateNow = Date.now();
    const endTime = minutesToTime(storeLocation?.shiftConfig?.endMinutes ?? 0);
    const startTime = minutesToTime(storeLocation?.shiftConfig?.startMinutes ?? 0);
    if (storeLocation?.shiftConfig) {
      const [endH, endM] = endTime.split(":").map((s) => parseInt(s, 10));
      const endDate = new Date(dateNow);
      endDate.setHours(endH, endM, 0, 0);
      if (dateNow > endDate.getTime()) {
        toast.error(t("error_store_closed"));
        return;
      }

      const [startH, startM] = startTime.split(":").map((s) => parseInt(s, 10));
      const startDate = new Date(dateNow);
      startDate.setHours(startH, startM, 0, 0);
      if (dateNow < startDate.getTime()) {
        toast.error(t("error_store_not_open"));
        return;
      }
    }
    setShowModal(true);
  };
  const [tiers, setTiers] = useState<GroupDiscountTier[]>([]);
  const [expiryMinutes, setExpiryMinutes] = useState(120);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    fetchGroupOrderConfig()
      .then((cfg) => {
        setTiers(cfg.discountTiers);
        setIsEnabled(cfg.isEnabled);
        if (cfg.expiryMinutes) setExpiryMinutes(cfg.expiryMinutes);
      })
      .catch(() => { })
      .finally(() => setConfigLoaded(true));
  }, []);

  const sorted = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
  const maxDiscount = tiers.length > 0 ? Math.max(...tiers.map((t) => t.discountPercent)) : null;

  const hasDiscount = configLoaded && sorted.length > 0;

  const HOW_IT_WORKS = [
    { Icon: Sparkles, step: "01", title: t("step_create_title"), desc: t("step_create_desc") },
    { Icon: Share2, step: "02", title: t("step_invite_title"), desc: t("step_invite_desc") },
    { Icon: ShoppingBag, step: "03", title: t("step_order_title"), desc: t("step_order_desc") },
    {
      Icon: Zap, step: "04",
      title: hasDiscount ? t("step_lock_title") : t("step_lock_title_no_discount"),
      desc: hasDiscount ? t("step_lock_desc") : t("step_lock_desc_no_discount"),
    },
  ];

  const FEATURES = [
    { icon: <Share2 className="size-4.5 text-[#1a3c34]" />, title: t("feature_fraud_title"), desc: t("feature_fraud_desc") },
    { icon: <Zap className="size-4.5 text-[#1a3c34]" />, title: t("feature_realtime_title"), desc: t("feature_realtime_desc") },
    { icon: <ShoppingBag className="size-4.5 text-[#1a3c34]" />, title: t("feature_payment_title"), desc: t("feature_payment_desc") },
    { icon: <Timer className="size-4.5 text-[#1a3c34]" />, title: t("feature_expiry_title", { time: fmtExpiry(expiryMinutes, locale) }), desc: t("feature_expiry_desc") },
  ];

  return (
    <>
      <AnimatePresence>
        {showModal && <CreateGroupOrderModal onClose={() => setShowModal(false)} hasActiveSession={hasActiveSession} />}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a3c34] via-[#1e4438] to-[#112a21] px-5 pb-20 pt-16 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.03] blur-3xl" />
          <div className="absolute -bottom-16 left-1/4 size-96 rounded-full bg-[#99d6b3]/[0.06] blur-3xl" />
          <div className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-2xl text-center">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              {hasDiscount ? t("group_order_headline_1") : t("group_order_headline_1_no_discount")}
              <br />
              <span className="text-[#99d6b3]">
                {hasDiscount ? t("group_order_headline_2") : t("group_order_headline_2_no_discount")}
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60"
            >
              {hasDiscount ? t("group_order_subline") : t("group_order_subline_no_discount")}
            </motion.p>

            {maxDiscount !== null && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.22 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
              >
                {[
                  { label: t("max_discount_label"), value: <><CountUp to={maxDiscount} />%</> },
                  { label: t("one_per_account"), value: t("fair_value") },
                  { label: t("time_limit_label"), value: fmtExpiry(expiryMinutes, locale) },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-bold text-white sm:text-3xl">{s.value}</p>
                    <p className="mt-0.5 text-xs text-white/45">{s.label}</p>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }} className="mt-8 flex flex-col items-center gap-3"
            >
              {configLoaded && !isEnabled ? (
                <div className="flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white/70">
                  <PauseCircle className="size-4.5 shrink-0" />
                  Tính năng đặt nhóm đang tạm ngừng
                </div>
              ) : (
                <>
                  <Button
                    isDisabled={!isEnabled}
                    className="inline-flex h-14 items-center gap-2.5 rounded-full bg-white px-8 text-base font-bold text-[#1a3c34] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.3)] hover:opacity-95 disabled:opacity-50"
                    onPress={handleCreatePress}
                  >
                    <Users className="size-5" />
                    {accessToken ? t("create_group_order_now") : t("login_to_create_group_order")}
                    <ArrowRight className="size-4.5" />
                  </Button>
                  <p className="text-xs text-white/35">
                    {accessToken ? t("group_order_cta_note") : t("login_to_create_group_order_note")}
                  </p>
                </>
              )}
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 40" fill="none" className="w-full">
            <path d="M0 40 C360 0 1080 0 1440 40 L1440 40 L0 40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-5 py-14 sm:py-16">
        <div className="mx-auto max-w-[72rem]">
          <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }} className="mb-10 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{t("how_it_works_eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("only_4_steps")}</h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div key={step.step} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-32px" }} transition={{ delay: i * 0.08 }}
                className="relative flex flex-col gap-4 rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)]"
              >
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 items-center justify-center lg:flex">
                    <ChevronRight className="size-4 text-foreground/20" />
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
                    <step.Icon className="size-5 text-[#1a3c34]" />
                  </div>
                  <span className="mt-0.5 font-mono text-[11px] font-bold tracking-widest text-foreground/15">{step.step}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/50">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Discount tiers — hidden when config loaded but empty ── */}
      {(!configLoaded || sorted.length > 0) && (
        <section className="bg-[#f7f7f7] px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-[72rem]">
            <div className="mx-auto max-w-xl">
              <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-48px" }} className="mb-3 text-center"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{t("group_discount_eyebrow")}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("more_members_more_discount")}</h2>
                <p className="mt-2 text-sm text-foreground/50">{t("auto_discount_desc")}</p>
              </motion.div>

              {maxDiscount !== null && (
                <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-32px" }}
                  className="mb-5 overflow-hidden rounded-3xl bg-[#1a3c34] px-8 py-10 text-center"
                >
                  <Zap className="mx-auto mb-2 size-7 text-[#99d6b3]" />
                  <p className="text-5xl font-bold text-white sm:text-6xl"><CountUp to={maxDiscount} suffix="%" /></p>
                  <p className="mt-2 text-sm text-white/60">{t("max_discount_when_big")}</p>
                  <div className="mt-5 flex justify-center gap-4 text-center text-xs text-white/40">
                    <span>{t("auto_applied")}</span>
                    <span>·</span>
                    <span>{t("no_code_needed")}</span>
                    <span>·</span>
                    <span>{t("applied_to_total")}</span>
                  </div>
                </motion.div>
              )}

              {!configLoaded ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-foreground/25" />
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {sorted.map((tier, i) => (
                    <DiscountTierCard key={tier.minParticipants} tier={tier} index={i}
                      isMax={i === sorted.length - 1} isActive={false} activeCount={1}
                    />
                  ))}
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-black/8 px-4 py-2.5">
                    <Zap className="size-3.5 shrink-0 text-[#1a3c34]/50" />
                    <p className="text-[11px] text-foreground/45">{t("discount_note")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="px-5 py-14 sm:py-16">
        <div className="mx-auto max-w-[72rem]">
          <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }} className="mb-10 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{t("why_group_order_eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t("new_way_to_order")}</h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-32px" }} transition={{ delay: i * 0.06 }}
                className="flex flex-col gap-3 rounded-2xl border border-black/6 bg-white p-5"
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#1a3c34]/8">{f.icon}</div>
                <div>
                  <p className="text-sm font-bold text-foreground">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/50">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-5 pb-16 sm:pb-20">
        <div className="mx-auto max-w-[72rem]">
          <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-48px" }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3c34] to-[#0f2820] px-8 py-14 text-center"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-12 -top-12 size-52 rounded-full bg-white/[0.03] blur-3xl" />
              <div className="absolute -bottom-12 -left-12 size-52 rounded-full bg-[#99d6b3]/[0.05] blur-3xl" />
            </div>
            <div className="relative">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10">
                <Users className="size-7 text-white" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{t("ready_yet")}</p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t("order_as_group")}</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">
                {hasDiscount ? t("group_order_final_desc") : t("group_order_final_desc_no_discount")}
              </p>
              {configLoaded && !isEnabled ? (
                <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white/60">
                  <PauseCircle className="size-4 shrink-0" />
                  Tạm ngừng nhận đơn nhóm
                </div>
              ) : (
                <Button
                  isDisabled={!isEnabled}
                  className="mt-7 inline-flex h-13 items-center gap-2.5 rounded-full bg-white px-8 text-sm font-bold text-[#1a3c34] hover:opacity-95 disabled:opacity-50"
                  onPress={handleCreatePress}
                >
                  <Users className="size-4.5" />
                  {accessToken ? t("create_group_order_free") : t("login_to_create_group_order")}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
