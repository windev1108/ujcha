"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Check, Copy, Gift, Lock, ShoppingBag, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { useMyVouchersQuery } from "@/services/voucher/hooks";
import { useAuthStore } from "@/store/auth-store";
import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import type { MyVoucherItem } from "@/services/voucher/api";

function formatVnd(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function VoucherCard({ item, index }: { item: MyVoucherItem; index: number }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const v = item.voucher;
  const isUsed = !!item.usedAt;
  const isExpired = v.isExpired || !v.isActive;
  const isInactive = isUsed || isExpired;

  const isPercent = v.discountType === "percent";
  const discountLabel = isPercent
    ? `Giảm ${v.discountValue}%`
    : `Giảm ${formatVnd(v.discountValue)}`;

  const sourceLabel: Record<string, string> = {
    welcome: t("source_welcome"),
    referral: t("source_referral"),
    admin_grant: t("source_admin_grant"),
  };

  const maxLabel =
    isPercent && v.maxDiscountAmount
      ? t("max_discount", { amount: formatVnd(v.maxDiscountAmount) })
      : null;

  async function handleCopy() {
    await navigator.clipboard.writeText(v.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: easeOutSmooth, delay: index * 0.055 }}
      className={`rounded-3xl border bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)] ${isInactive ? "border-black/4 opacity-60" : "border-black/6"
        }`}
    >
      <div className="flex items-stretch">
        {/* Left color accent */}
        <div
          className={`w-[5px] shrink-0 rounded-l-3xl ${isUsed ? "bg-surface-tertiary" : isExpired ? "bg-red-200" : "bg-[#1a3c34]"
            }`}
        />

        <div className="flex-1 p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex size-9 items-center justify-center rounded-2xl ${isInactive ? "bg-surface-card" : "bg-[#1a3c34]/8"
                  }`}
              >
                <Ticket
                  className={`size-4 ${isInactive ? "text-muted" : "text-[#1a3c34]"}`}
                />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {sourceLabel[item.source] ?? "Voucher"}
                  </p>
                  {isUsed && (
                    <span className="rounded-full bg-surface-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
                      {t("used")}
                    </span>
                  )}
                  {!isUsed && isExpired && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-500">
                      {t("expired")}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-bold leading-tight text-foreground">
                  {v.name}
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${isInactive
                ? "bg-surface-card text-muted ring-black/8"
                : "bg-green-50 text-green-700 ring-green-200"
                }`}
            >
              {discountLabel}
            </span>
          </div>

          {/* Dashed divider */}
          <div className="my-4 border-t border-dashed border-black/10" />

          {/* Code + copy */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                {t("voucher_code_label")}
              </p>
              <p
                className={`mt-0.5 font-mono text-lg font-bold tracking-widest ${isInactive ? "text-muted line-through" : "text-[#1a3c34]"
                  }`}
              >
                {v.code}
              </p>
            </div>

            {!isInactive ? (
              <div className="flex items-center gap-2">
                {/* <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-full bg-[#1a3c34] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-85"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" />
                      {t("copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      {t("copy")}
                    </>
                  )}
                </button> */}
                <button
                  type="button"
                  onClick={() => router.push(ROUTES.MENU)}
                  className="flex items-center gap-1.5 rounded-full bg-[#1a3c34] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-85"
                >
                  <ShoppingBag className="size-3.5" />
                  {t("order")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Lock className="size-3.5" />
                {isUsed ? t("voucher_used_on", { date: formatDate(item.usedAt!) }) : t("cannot_use")}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[11px] text-muted">
              {t("min_order_label", { amount: formatVnd(v.minOrderAmount) })}
            </span>
            {maxLabel && (
              <>
                <span className="text-muted/40">·</span>
                <span className="text-[11px] text-muted">{maxLabel}</span>
              </>
            )}
            {v.endsAt && !isUsed && (
              <>
                <span className="text-muted/40">·</span>
                <span className={`text-[11px] ${isExpired ? "text-red-400" : "text-muted"}`}>
                  {t("expiry_label")} {formatDate(v.endsAt)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div >
  );
}

function EmptyState() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutSmooth }}
        className="mb-5 flex size-20 items-center justify-center rounded-full bg-surface-card"
      >
        <Gift className="size-9 text-foreground/25" />
      </motion.div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {t("voucher_bag")}
      </p>
      <p className="mt-2 text-xl font-bold text-foreground">{t("no_vouchers")}</p>
      <p className="mt-2 max-w-[260px] text-sm text-muted">
        {t("no_vouchers_desc")}
      </p>
      <button
        type="button"
        onClick={() => router.push(ROUTES.MENU)}
        className="mt-6 flex items-center gap-2 rounded-full bg-[#1a3c34] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ShoppingBag className="size-4" />
        {t("view_menu")}
      </button>
    </div>
  );
}

function LoginPrompt() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutSmooth }}
        className="mb-5 flex size-20 items-center justify-center rounded-full bg-surface-card"
      >
        <Lock className="size-9 text-foreground/25" />
      </motion.div>
      <p className="mt-2 text-xl font-bold text-foreground">{t("login_to_view_vouchers")}</p>
      <p className="mt-2 max-w-[260px] text-sm text-muted">
        {t("voucher_login_desc")}
      </p>
      <button
        type="button"
        onClick={() => router.push(ROUTES.LOGIN)}
        className="mt-6 rounded-full bg-[#1a3c34] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {t("login")}
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-9 animate-pulse rounded-2xl bg-surface-card" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-16 animate-pulse rounded-full bg-surface-card" />
            <div className="h-4 w-36 animate-pulse rounded-lg bg-surface-card" />
          </div>
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-surface-card" />
      </div>
      <div className="my-4 h-px bg-surface-card" />
      <div className="flex items-end justify-between">
        <div className="space-y-1.5">
          <div className="h-2.5 w-20 animate-pulse rounded-full bg-surface-card" />
          <div className="h-6 w-28 animate-pulse rounded-lg bg-surface-card" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-full bg-surface-card" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-surface-card" />
        </div>
      </div>
    </div>
  );
}

export function VouchersPageShell() {
  const t = useTranslations();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useMyVouchersQuery();

  const available = data?.filter((v) => !v.usedAt && !v.voucher.isExpired && v.voucher.isActive) ?? [];
  const used = data?.filter((v) => v.usedAt || v.voucher.isExpired || !v.voucher.isActive) ?? [];

  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-2xl px-4 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={revealTransition}
          className="mb-7"
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-1.5 text-sm text-foreground/50 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("back")}
          </button>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            {t("personal_eyebrow")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("my_vouchers")}
            </h1>
            {data && data.length > 0 && (
              <span className="rounded-full bg-[#1a3c34]/8 px-3 py-1.5 text-sm font-semibold text-[#1a3c34]">
                {t("available_count", { count: available.length })}
              </span>
            )}
          </div>
        </motion.div>

        {!accessToken && <LoginPrompt />}

        {accessToken && isLoading && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {accessToken && !isLoading && data?.length === 0 && <EmptyState />}

        {accessToken && !isLoading && data && data.length > 0 && (
          <div className="space-y-6">
            {available.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {t("available_count", { count: available.length })}
                </p>
                {available.map((item, i) => (
                  <VoucherCard key={item.id} item={item} index={i} />
                ))}
              </div>
            )}

            {used.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  {t("used_expired_count", { count: used.length })}
                </p>
                {used.map((item, i) => (
                  <VoucherCard key={item.id} item={item} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
