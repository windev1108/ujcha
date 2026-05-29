"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, CheckCircle2, Coins, Gift, Loader2, ShoppingBag, Ticket } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth-store";
import { useProfileQuery } from "@/services/profile/hooks";
import {
  fetchPointRewardCatalog,
  redeemPointReward,
  type PointRewardCatalogItem,
} from "@/services/order/api";
import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";

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

function RewardCard({
  item,
  index,
  pointBalance,
  onRedeem,
  isRedeeming,
}: {
  item: PointRewardCatalogItem;
  index: number;
  pointBalance: number;
  onRedeem: (id: string) => void;
  isRedeeming: boolean;
}) {
  const t = useTranslations();
  const v = item.voucher;
  const canAfford = pointBalance >= item.pointCost;
  const isPercent = v.discountType === "percent";
  const discountLabel = isPercent
    ? `Giảm ${v.discountValue}%`
    : `Giảm ${formatVnd(v.discountValue)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: index * 0.06, ease: easeOutSmooth }}
      className={`relative overflow-hidden rounded-3xl border bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)] transition ${canAfford ? "border-black/6 hover:border-kun-primary/30" : "border-black/5 opacity-60"
        }`}
    >
      {/* Decorative top stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#1a3c34] to-[#5a8f7a]" />

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
            <Ticket className="size-5 text-[#1a3c34]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#1a1a1a]">{item.name}</p>
            {item.description && (
              <p className="mt-0.5 text-xs text-foreground/55 line-clamp-2">{item.description}</p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-black/6 bg-[#f7f7f7] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/40">
            {t("voucher_received")}
          </p>
          <p className="mt-1 text-base font-bold text-[#1a3c34]">{discountLabel}</p>
          {v.discountType === "percent" && v.maxDiscountAmount && (
            <p className="text-xs text-foreground/50">{t("max_discount", { amount: formatVnd(v.maxDiscountAmount) })}</p>
          )}
          {Number(v.minOrderAmount) > 0 && (
            <p className="text-xs text-foreground/50">
              {t("min_order_label", { amount: formatVnd(v.minOrderAmount) })}
            </p>
          )}
          {v.endsAt && (
            <p className="mt-1 text-xs text-foreground/40">{`${t("expiry_label")} ${formatDate(v.endsAt)}`}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Coins className="size-4 text-[#c9a227]" />
            <span className="text-sm font-bold tabular-nums text-[#1a1a1a]">
              {`${item.pointCost.toLocaleString("vi-VN")} ${t("points_unit")}`}
            </span>
          </div>
          <button
            type="button"
            disabled={!canAfford || isRedeeming}
            onClick={() => onRedeem(item.id)}
            className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${canAfford
              ? "bg-[#1a3c34] text-white hover:opacity-90 disabled:opacity-60"
              : "bg-surface-card text-foreground/40 cursor-not-allowed"
              }`}
          >
            {isRedeeming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Gift className="size-3.5" />
            )}
            {canAfford ? t("redeem_now") : t("insufficient_points")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-2xl bg-[#1a3c34] px-4 py-3 shadow-xl"
    >
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#99d6b3]" />
      <p className="flex-1 text-sm font-medium text-white">{message}</p>
      <button type="button" onClick={onClose} className="text-white/60 hover:text-white text-xs">
        ✕
      </button>
    </motion.div>
  );
}

export function RewardsPageShell() {
  const t = useTranslations();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { data: profile, refetch: refetchProfile } = useProfileQuery();
  const qc = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["point-reward-catalog"],
    queryFn: fetchPointRewardCatalog,
    staleTime: 60_000,
    enabled: !!accessToken,
  });

  const redeemMutation = useMutation({
    mutationFn: (id: string) => redeemPointReward(id),
    onSuccess: async (data) => {
      await refetchProfile();
      await qc.invalidateQueries({ queryKey: ["my-vouchers"] });
      setToast(data.message);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (err: unknown) => {
      const raw = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setToast(raw ?? t("redeem_failed"));
      setTimeout(() => setToast(null), 4000);
    },
    onSettled: () => setRedeemingId(null),
  });

  function handleRedeem(id: string) {
    if (redeemMutation.isPending) return;
    setRedeemingId(id);
    redeemMutation.mutate(id);
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-surface-soft px-4 py-16 text-center">
        <p className="text-foreground/60">{t("login_to_view_rewards")}</p>
        <button
          type="button"
          onClick={() => router.push(ROUTES.LOGIN)}
          className="mt-4 rounded-full bg-[#1a3c34] px-6 py-2.5 text-sm font-semibold text-white"
        >
          {t("login")}
        </button>
      </div>
    );
  }

  const pointBalance = profile?.pointBalance ?? 0;
  const items = catalogQuery.data ?? [];

  return (
    <div className="min-h-screen bg-surface-soft pb-16">
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...revealTransition, ease: easeOutSmooth }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5a8f7a]">
            {t("member_perks")}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1a3c34] sm:text-3xl">
            {t("rewards_for_you")}
          </h1>
          <p className="mt-2 text-sm text-foreground/55">
            {t("rewards_desc")}
          </p>
        </motion.div>

        {/* Point balance card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...revealTransition, delay: 0.06, ease: easeOutSmooth }}
          className="mt-6 flex items-center gap-4 rounded-3xl border border-[#1a3c34]/15 bg-gradient-to-br from-[#1a3c34] to-[#2d4a43] p-5 text-white shadow-[0_4px_20px_-8px_rgba(26,60,52,0.4)]"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <Coins className="size-6 text-[#c9a227]" />
          </div>
          <div>
            <p className="text-xs font-medium text-white/60">{t("points_balance_label")}</p>
            <p className="text-3xl font-bold tabular-nums">
              {pointBalance.toLocaleString("vi-VN")}
            </p>
            <p className="text-xs text-white/50">{t("points_unit")}</p>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => router.push(ROUTES.VOUCHERS)}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition"
            >
              <Ticket className="size-3.5" />
              {t("voucher_bag")}
            </button>
          </div>
        </motion.div>

        {/* Catalog */}
        <div className="mt-8">
          {catalogQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-3xl bg-white" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-20 text-center"
            >
              <div className="flex size-16 items-center justify-center rounded-3xl bg-surface-card">
                <Gift className="size-8 text-foreground/30" />
              </div>
              <div>
                <p className="font-semibold text-foreground/60">{t("no_rewards")}</p>
                <p className="mt-1 text-sm text-foreground/40">
                  {t("no_rewards_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(ROUTES.MENU)}
                className="mt-2 flex items-center gap-1.5 rounded-full bg-[#1a3c34] px-5 py-2.5 text-sm font-semibold text-white"
              >
                <ShoppingBag className="size-4" />
                {t("buy_more_to_earn")}
              </button>
            </motion.div>
          ) : (
            <>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {t("rewards_catalog_count", { count: items.length })}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item, i) => (
                  <RewardCard
                    key={item.id}
                    item={item}
                    index={i}
                    pointBalance={pointBalance}
                    onRedeem={handleRedeem}
                    isRedeeming={redeemingId === item.id && redeemMutation.isPending}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && (
        <SuccessToast message={toast} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
