"use client";

import { Button, Card, CardContent } from "@heroui/react";
import { motion } from "motion/react";
import { ShoppingBag, Tag, Users } from "lucide-react";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CHECKOUT_TAB } from "@/app/[locale]/checkout/components/checkout-tab";
import { ROUTES } from "@/lib/routes";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

type Props = {
  subtotal: number;
  total: number;
  selectedCount: number;
  selectedIds: Set<string>;
};

export function OrderSummary({ subtotal, total, selectedCount, selectedIds }: Props) {
  const t = useTranslations();
  const checkoutDisabled = selectedCount === 0;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: 0.06 }}
      className="w-full shrink-0 lg:sticky lg:top-28 lg:max-w-md lg:justify-self-end"
    >
      <div className="space-y-4">
        <Card className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.12)]">
          <CardContent className="space-y-4 p-6 sm:p-7">
            <div className="flex justify-between text-sm text-foreground/70">
              <span>{t("temporarily_calculated")}</span>
              <span className="tabular-nums font-medium text-foreground">{formatVnd(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-foreground/70">
              <span>{t("shipping_fee")}</span>
              <span className="font-medium text-kun-products-forest">{t("shipping_undetermined")}</span>
            </div>
            <div className="border-t border-black/6 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-foreground/70">{t("order_total")}</span>
                <span className="text-2xl font-bold tabular-nums text-kun-primary">
                  {formatVnd(total)}
                </span>
              </div>
            </div>

            {checkoutDisabled ? (
              <Button
                size="lg"
                isDisabled
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-black/10 text-base font-semibold text-foreground/40 cursor-not-allowed"
              >
                {t("select_at_least_1_product")}
              </Button>
            ) : (
              <Link
                href={`${ROUTES.CHECKOUT}?tab=${CHECKOUT_TAB.DELIVERY}&items=${Array.from(selectedIds).join(",")}`}
              >
                <Button
                  size="lg"
                  className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-base font-semibold text-white hover:opacity-90"
                  onPress={() => { }}
                >
                  {t("continue_checkout")} ({selectedCount})
                  <ShoppingBag className="size-5" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-black/10 px-4 py-3 text-xs text-foreground/50">
          <Tag className="size-3.5 shrink-0" />
          {t("voucher_and_points_info")}
        </div>

        <Link
          href={ROUTES.GROUP_ORDERS}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#1a3c34]/30 bg-gradient-to-br from-[#f0faf6] to-white px-4 py-3.5 text-left transition hover:border-[#1a3c34]/50 hover:from-[#e6f5ef]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1a3c34]/10">
            <Users className="size-4.5 text-[#1a3c34]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1a3c34]">{t("group_orders")}</p>
            <p className="text-[11px] text-[#1a3c34]/60">{t("group_order_cart_desc")}</p>
          </div>
        </Link>
      </div>
    </motion.aside>
  );
}
