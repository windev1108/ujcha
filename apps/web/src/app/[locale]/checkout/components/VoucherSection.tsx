"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, Ticket, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePreviewVoucherMutation } from "@/services/order/hooks";
import { useMyVouchersQuery } from "@/services/voucher/hooks";
import type { MyVoucherItem } from "@/services/voucher/api";
import type { VoucherPreviewResult } from "@/services/order/api";
import { useState } from "react";

type Props = {
  subtotal: number;
  applied: VoucherPreviewResult | null;
  onApply: (result: VoucherPreviewResult) => void;
  onRemove: () => void;
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type TFn = ReturnType<typeof useTranslations>;

function voucherLabel(v: MyVoucherItem["voucher"], t: TFn, fmt: (n: number) => string) {
  if (v.discountType === "percent") {
    const percent = parseFloat(v.discountValue).toFixed(0);
    if (v.maxDiscountAmount) {
      return t("voucher_percent_off_capped", { percent, max: fmt(parseFloat(v.maxDiscountAmount)) });
    }
    return t("voucher_percent_off", { percent });
  }
  return t("voucher_fixed_off", { amount: fmt(parseFloat(v.discountValue)) });
}

function isVoucherAvailable(item: MyVoucherItem, subtotal: number) {
  if (item.usedAt) return false;
  if (!item.voucher.isActive || item.voucher.isExpired) return false;
  if (item.voucher.endsAt && new Date(item.voucher.endsAt) < new Date()) return false;
  if (parseFloat(item.voucher.minOrderAmount) > subtotal) return false;
  return true;
}

export function VoucherSection({ subtotal, applied, onApply, onRemove }: Props) {
  const t = useTranslations();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mutation = usePreviewVoucherMutation();
  const { data: myVouchers = [], isLoading } = useMyVouchersQuery();

  const available = myVouchers.filter((v) => isVoucherAvailable(v, subtotal));
  const unavailable = myVouchers.filter((v) => !isVoucherAvailable(v, subtotal) && !v.usedAt);

  async function applyFromWallet(code: string) {
    setErrorMsg(null);
    try {
      const result = await mutation.mutateAsync({ code, orderAmount: subtotal });
      onApply(result);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t("voucher_apply_failed");
      setErrorMsg(msg);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-kun-primary/20 bg-kun-primary/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="size-4 shrink-0 text-kun-primary" />
          <div>
            <p className="text-sm font-semibold text-kun-primary">{applied.code}</p>
            <p className="text-xs text-foreground/60">
              {applied.name} · -{formatVnd(applied.discountAmount)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("remove_voucher")}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/40 transition hover:bg-black/8 hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-card" />
        ))}
      </div>
    );
  }

  if (myVouchers.length === 0 || (available.length === 0 && unavailable.length === 0)) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-black/6 bg-surface-soft py-6 text-center">
        <Ticket className="size-7 text-muted/30" />
        <p className="text-xs text-muted">{t("no_vouchers")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {available.length > 0 && (
        <div className="space-y-1.5">
          {available.map((item) => (
            <VoucherCard
              key={item.id}
              item={item}
              subtotal={subtotal}
              onSelect={() => void applyFromWallet(item.voucher.code)}
              isApplying={mutation.isPending}
              available
            />
          ))}
        </div>
      )}

      {unavailable.length > 0 && (
        <>
          {available.length > 0 && <div className="border-t border-black/5" />}
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted/60">
            {t("not_eligible")}
          </p>
          <div className="space-y-1.5 opacity-50">
            {unavailable.map((item) => (
              <VoucherCard
                key={item.id}
                item={item}
                subtotal={subtotal}
                onSelect={() => {}}
                isApplying={false}
                available={false}
              />
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 pl-1 text-xs font-medium text-red-600"
          >
            <X className="size-3.5 shrink-0" />
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function VoucherCard({
  item,
  subtotal,
  onSelect,
  isApplying,
  available,
}: {
  item: MyVoucherItem;
  subtotal: number;
  onSelect: () => void;
  isApplying: boolean;
  available: boolean;
}) {
  const t = useTranslations();
  const { voucher } = item;
  const minOrder = parseFloat(voucher.minOrderAmount);
  const shortfall = minOrder - subtotal;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        available
          ? "border-kun-primary/15 bg-kun-primary/[0.03]"
          : "border-black/6 bg-surface-soft"
      }`}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          available ? "bg-kun-primary/10 text-kun-primary" : "bg-surface-card text-muted/50"
        }`}
      >
        <Ticket className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs font-bold tracking-wide text-foreground">
          {voucher.code}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {voucherLabel(voucher, t, formatVnd)}
          {minOrder > 0 && ` · ${t("min_order_label", { amount: formatVnd(minOrder) })}`}
        </p>
        {!available && shortfall > 0 && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-600">
            {t("voucher_shortfall", { amount: formatVnd(shortfall) })}
          </p>
        )}
      </div>

      {available && (
        <button
          type="button"
          onClick={onSelect}
          disabled={isApplying}
          className="shrink-0 rounded-full bg-kun-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isApplying ? <Loader2 className="size-3.5 animate-spin" /> : t("use_voucher")}
        </button>
      )}
    </div>
  );
}
