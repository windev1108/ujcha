"use client";

import { Button, Card, CardContent } from "@heroui/react";
import { motion } from "motion/react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Navigation, Printer } from "lucide-react";
import { ShippingFeeTooltip } from "@/components/common/ShippingFeeTooltip";
import { usePublicShippingConfigQuery } from "@/services/shipping/hooks";
import Image from "next/image";
import Link from "next/link";
import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { useTranslations, useLocale } from "next-intl";
import { useLocalizedHref } from "../../../../i18n/use-localized-href";
import { getDisplayName } from "@/lib/product-name";

import type { ApiCartItem } from "@/services/cart/types";
import { normalizeOptionGroups, computeOptionSurcharge } from "@/lib/product-options";
import { ItemOptionsDisplay } from "@/components/cart/ItemOptionsDisplay";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

type Props = {
  items: ApiCartItem[];
  subtotal: number;
  discount: number;
  pointDiscount: number;
  shippingFee: number;
  shippingIsFree: boolean;
  shippingIsOutOfRange: boolean;
  shippingIsDisabled: boolean;
  distanceKm?: number;
  freeShipDistanceKm?: number;
  total: number;
  isDelivery: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  isExpired?: boolean;
  isAddressInvalid?: boolean;
  errorMessage?: string | null;
  onSubmit: () => void;
  onPrint?: () => void;
};

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOutSmooth } },
};

export function CheckoutOrderSummary({
  items,
  subtotal,
  discount,
  pointDiscount,
  shippingFee,
  shippingIsFree,
  shippingIsOutOfRange,
  shippingIsDisabled,
  distanceKm,
  freeShipDistanceKm,
  total,
  isDelivery,
  isSubmitting,
  isSuccess,
  isExpired,
  isAddressInvalid,
  errorMessage,
  onSubmit,
  onPrint,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const { route } = useLocalizedHref();
  const { data: shippingConfig } = usePublicShippingConfigQuery();

  return (
    <motion.aside
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: 0.08 }}
      className="relative z-0 w-full lg:sticky lg:top-24 lg:max-w-md lg:self-start"
    >
      <Card className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.12)]">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            {t("order_summary")}
          </h2>

          <motion.ul
            className="space-y-4"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {items.map((item) => {
              const imageUrl = item.product.imageUrls[0] ?? null;
              const base = parseFloat(item.product.price);
              const discountedBase = item.product.finalPrice;
              const groups = normalizeOptionGroups(item.product.optionGroups);
              const optionSurcharge = computeOptionSurcharge(groups, item.selectedOptions);
              const toppingTotal = (item.toppings ?? []).reduce(
                (s, t) => s + parseFloat(t.topping.price),
                0,
              );
              const unitPrice = discountedBase + optionSurcharge + toppingTotal;
              const lineTotal = unitPrice * item.quantity;

              return (
                <motion.li
                  key={item.id}
                  variants={rowVariants}
                  className="flex gap-3 border-b border-black/6 pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="relative size-14 shrink-0 sm:size-16">
                    <div
                      className="absolute inset-0 overflow-hidden rounded-xl bg-surface-card ring-1 ring-black/6"
                      style={{ backgroundColor: imageUrl ? undefined : "#1a3c34" }}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-black text-white/20 select-none">
                            {getDisplayName(item.product, locale).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="absolute -bottom-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-kun-primary text-[9px] font-bold text-white ring-2 ring-white">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug text-foreground">
                        {getDisplayName(item.product, locale)}
                      </p>
                      <div className="shrink-0 text-right">
                        <div className="flex items-center gap-2">
                          {item.product.discountPercent > 0 && (
                            <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">
                              -{item.product.discountPercent}%
                            </span>
                          )}
                          <p className="text-sm font-bold tabular-nums text-kun-primary">{formatVnd(lineTotal)}</p>
                        </div>
                        {item.product.discountPercent > 0 && (
                          <p className="text-xs text-muted line-through tabular-nums">
                            {formatVnd(base * item.quantity)}
                          </p>
                        )}

                      </div>
                    </div>
                    <p className="mt-0.5 text-xs text-foreground/50">
                      {getDisplayName(item.product.category, locale)}
                    </p>
                    <ItemOptionsDisplay item={item} />

                  </div>
                </motion.li>
              );
            })}
          </motion.ul>

          <div className="space-y-2.5 border-t border-black/6 pt-4 text-sm">
            <div className="flex justify-between text-foreground/70">
              <span>{t("temporarily_calculated")}</span>
              <span className="tabular-nums font-medium text-foreground">{formatVnd(subtotal)}</span>
            </div>
            {isDelivery && (
              <div className="space-y-1">
                <div className="flex justify-between text-foreground/70">
                  <span className="flex items-center gap-1">
                    {t("shipping_fee")}
                    {shippingConfig && <ShippingFeeTooltip config={shippingConfig} />}
                  </span>
                  {shippingIsDisabled || !isDelivery ? (
                    <span className="text-xs font-medium text-muted">{t("shipping_undetermined")}</span>
                  ) : shippingIsOutOfRange ? (
                    <span className="text-xs font-medium text-danger">{t("out_of_delivery_range")}</span>
                  ) : shippingIsFree || shippingFee === 0 ? (
                    <span className="font-medium uppercase text-kun-products-forest">{t("free")}</span>
                  ) : (
                    <span className="tabular-nums font-medium text-foreground">{formatVnd(shippingFee)}</span>
                  )}
                </div>
                {!shippingIsDisabled && distanceKm !== undefined && distanceKm > 0 && (
                  <div className="flex items-center justify-end gap-1 text-[11px] tabular-nums text-muted">
                    <Navigation className="size-3 shrink-0" />
                    {t("distance_from_store", { distance: distanceKm.toFixed(1) })}
                  </div>
                )}
                {!shippingIsDisabled && freeShipDistanceKm !== undefined && freeShipDistanceKm > 0 && (
                  <div className="flex items-center justify-end gap-1 text-[11px] text-kun-products-forest">
                    <Navigation className="size-3 shrink-0" />
                    {t("free_ship_within_km", { km: freeShipDistanceKm })}
                  </div>
                )}
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-kun-products-forest">
                <span>{t("voucher_code_label")}</span>
                <span className="tabular-nums font-medium">-{formatVnd(discount)}</span>
              </div>
            )}
            {pointDiscount > 0 && (
              <div className="flex justify-between text-kun-products-forest">
                <span>{t("points_label")}</span>
                <span className="tabular-nums font-medium">-{formatVnd(pointDiscount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-black/6 pt-3">
              <span className="text-sm font-medium text-foreground/70">{t("order_total")}</span>
              <span className="text-xl font-bold tabular-nums text-kun-primary sm:text-2xl">
                {formatVnd(total)}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {errorMessage}
            </div>
          )}

          {isExpired ? (
            <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              {t("order_expired_cancelled")}
            </div>
          ) : isSuccess ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-2xl bg-kun-mint/20 px-4 py-3 text-sm font-medium text-kun-products-forest">
                <CheckCircle2 className="size-5 shrink-0" />
                {t("order_placed_success")}
              </div>
              {onPrint && (
                <Button
                  variant="outline"
                  size="md"
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-sm font-medium text-foreground/70 hover:bg-surface-secondary"
                  onPress={onPrint}
                >
                  <Printer className="size-4" />
                  {t("print_invoice")}
                </Button>
              )}
            </div>
          ) : (
            <Button
              size="lg"
              isDisabled={isSubmitting || items.length === 0 || (isDelivery && shippingIsOutOfRange) || !!isAddressInvalid}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-base font-semibold text-white hover:opacity-90 disabled:opacity-60"
              onPress={onSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  {t("placing_order")}
                </>
              ) : (
                <>
                  {isDelivery ? t("confirm_delivery_order") : t("confirm_store_order")}
                  <ArrowRight className="size-5" />
                </>
              )}
            </Button>
          )}

          <p className="text-center text-[10px] leading-relaxed text-foreground/55 sm:text-[11px]">
            {t("order_terms_prefix")}{" "}
            <Link href={route("TERMS")} className="underline underline-offset-2 hover:text-foreground">
              {t("terms_of_service")}
            </Link>{" "}
            {t("or")}{" "}
            <Link href={route("PRIVACY")} className="underline underline-offset-2 hover:text-foreground">
              {t("privacy_policy")}
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </motion.aside>
  );
}
