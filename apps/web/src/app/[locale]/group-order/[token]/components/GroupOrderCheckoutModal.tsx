"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  Check,
  Loader2,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createAddress, type UserAddress } from "@/services/order/api";
import { useShippingEstimateQuery, usePublicShippingConfigQuery } from "@/services/shipping/hooks";
import { ShippingFeeTooltip } from "@/components/common/ShippingFeeTooltip";
import { CheckoutFulfillmentSection, type StoreLocationInfo } from "@/app/[locale]/checkout/components/CheckoutFulfillmentSection";
import { PaymentMethodSection } from "@/app/[locale]/checkout/components/PaymentMethodSection";
import { CHECKOUT_TAB } from "@/app/[locale]/checkout/components/checkout-tab";
import type { DeliveryForm, PickupForm, PaymentMethod } from "@/app/[locale]/checkout/components/checkout-types";
import type { GroupOrderState } from "@/services/group-order/api";
import { useTranslations } from "next-intl";

const NEW_ADDRESS_ID = "__new__";

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type TabType = "delivery" | "pickup";

interface Props {
  open: boolean;
  onClose: () => void;
  state: GroupOrderState;
  savedAddresses: UserAddress[];
  profile?: { name?: string | null; phone?: string | null } | null;
  storeLocation?: StoreLocationInfo | null;
  onSave: (payload: {
    type: TabType;
    inlineAddress?: { fullAddress: string; lat: number; lng: number };
    addressId?: string;
    shippingFee?: number;
    paymentType: "cash" | "bank_transfer";
    pickupTime?: string;
  }) => Promise<void>;
  totalAmount: number;
}

export function GroupOrderCheckoutModal({
  open,
  onClose,
  state,
  savedAddresses,
  profile,
  storeLocation,
  onSave,
  totalAmount,
}: Props) {
  const t = useTranslations();
  const { data: shippingConfig } = usePublicShippingConfigQuery();

  const TABS: { id: TabType; label: string; Icon: React.ElementType }[] = [
    { id: "delivery", label: t("type_delivery"), Icon: Truck },
    { id: "pickup", label: t("type_pickup"), Icon: ShoppingBag },
  ];

  const [type, setType] = useState<TabType>(
    (state.type === "table" ? "pickup" : state.type) as TabType,
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    state.address?.id ?? null,
  );
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    fullAddress: "",
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
    note: "",
    lat: null,
    lng: null,
  });
  const [pickupForm, setPickupForm] = useState<PickupForm>({
    mode: "asap",
    scheduledTime: "",
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
  });
  const [paymentType, setPaymentType] = useState<PaymentMethod>(
    (state.paymentType ?? "cash") as PaymentMethod,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showNewForm = selectedAddressId === NEW_ADDRESS_ID || savedAddresses.length === 0;

  useEffect(() => {
    if (!open) return;
    setType((state.type === "table" ? "pickup" : state.type) as TabType);
    setSelectedAddressId(state.address?.id ?? null);
    setDeliveryForm({
      fullAddress: "",
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      note: "",
      lat: null,
      lng: null,
    });
    setPickupForm({
      mode: "asap",
      scheduledTime: "",
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
    });
    setPaymentType((state.paymentType ?? "cash") as PaymentMethod);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || type !== "delivery" || selectedAddressId !== null) return;
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (def) setSelectedAddressId(def.id);
  }, [open, type, savedAddresses, selectedAddressId]);

  // ── Shipping estimate ──────────────────────────────────────────────────────

  const shippingLat = useMemo(() => {
    if (type !== "delivery") return null;
    if (showNewForm) return deliveryForm.lat;
    const addr = savedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lat && addr.lat !== 0 ? addr.lat : null;
  }, [type, showNewForm, deliveryForm.lat, savedAddresses, selectedAddressId]);

  const shippingLng = useMemo(() => {
    if (type !== "delivery") return null;
    if (showNewForm) return deliveryForm.lng;
    const addr = savedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lng && addr.lng !== 0 ? addr.lng : null;
  }, [type, showNewForm, deliveryForm.lng, savedAddresses, selectedAddressId]);

  const { data: shippingEstimate, isFetching: shippingFetching } =
    useShippingEstimateQuery(shippingLat, shippingLng, totalAmount);

  const shippingFee = type === "delivery" ? (shippingEstimate?.fee ?? 0) : 0;
  const shippingIsFree = type === "delivery" && (shippingEstimate?.isFree ?? false);
  const shippingIsOutOfRange = type === "delivery" && (shippingEstimate?.isOutOfRange ?? false);
  const grandTotal = totalAmount + shippingFee;

  // ── Confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setError(null);
    if (type === "delivery") {
      if (shippingIsOutOfRange) { setError(t("error_delivery_out_of_range")); return; }
      if (showNewForm && (!deliveryForm.fullAddress.trim() || deliveryForm.lat == null || deliveryForm.lng == null)) {
        setError(t("error_enter_delivery_address"));
        return;
      }
      if (!showNewForm && !selectedAddressId) { setError(t("error_select_address")); return; }
    }

    setSubmitting(true);
    try {
      let addressId: string | undefined;
      let inlineAddress: { fullAddress: string; lat: number; lng: number } | undefined;

      if (type === "delivery") {
        if (showNewForm) {
          // Chỉ gửi dữ liệu, KHÔNG tạo address ở đây
          inlineAddress = {
            fullAddress: deliveryForm.fullAddress.trim(),
            lat: deliveryForm.lat ?? 0,
            lng: deliveryForm.lng ?? 0,
          };
        } else {
          addressId = selectedAddressId ?? undefined;
        }
      }

      let pickupTime: string | undefined;
      if (type === "pickup") {
        pickupTime =
          pickupForm.mode === "asap"
            ? new Date(Date.now() + 20 * 60_000).toISOString()
            : pickupForm.scheduledTime
              ? new Date(pickupForm.scheduledTime).toISOString()
              : undefined;
      }

      await onSave({
        type,
        addressId,
        inlineAddress,
        shippingFee: type === "delivery" ? shippingFee : 0,
        paymentType,
        pickupTime,
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra. Vui lòng thử lại.";
      setError(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-surface-soft">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-black/6 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/6 text-foreground/60 transition-colors hover:bg-black/10"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              {t("group_checkout_eyebrow")}
            </p>
            <h2 className="truncate text-base font-bold text-foreground">{t("group_checkout_title")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-black/6"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-3.5 sm:px-6">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setType(id); setError(null); }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${type === id
                ? "bg-kun-primary text-white shadow-sm"
                : "bg-surface-card text-foreground/60 hover:bg-black/6"
                }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="space-y-4 sm:space-y-5">

            {/* ── 1. Fulfillment section (delivery address / pickup info) ──── */}
            <CheckoutFulfillmentSection
              tab={type === "delivery" ? CHECKOUT_TAB.DELIVERY : CHECKOUT_TAB.PICKUP}
              deliveryForm={deliveryForm}
              onDeliveryFormChange={(patch) => setDeliveryForm((p) => ({ ...p, ...patch }))}
              pickupForm={pickupForm}
              onPickupFormChange={(patch) => setPickupForm((p) => ({ ...p, ...patch }))}
              savedAddresses={savedAddresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              storeLocation={storeLocation}
              profileName={profile?.name}
              profilePhone={profile?.phone}
            />

            {/* Shipping estimate badge (delivery only) */}
            <AnimatePresence initial={false}>
              {type === "delivery" && (shippingFetching || shippingEstimate) && (
                <motion.div
                  key="ship-badge"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${shippingFetching
                    ? "bg-surface-card text-foreground/50"
                    : shippingIsOutOfRange
                      ? "bg-red-50 text-red-700"
                      : shippingIsFree
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-kun-mint/20 text-kun-products-forest"
                    }`}>
                    <div className="flex items-center gap-1.5">
                      {shippingFetching ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Bike className="size-4" />
                      )}
                      <span className="font-medium">
                        {shippingFetching
                          ? t("group_calculating_ship")
                          : shippingIsOutOfRange
                            ? t("group_out_of_range_badge")
                            : `${shippingEstimate!.distanceKm.toFixed(1)} km`
                        }
                      </span>
                    </div>
                    {!shippingFetching && !shippingIsOutOfRange && (
                      <span className="font-bold tabular-nums">
                        {shippingIsFree ? t("group_shipping_free") : fmtVnd(shippingFee)}
                      </span>
                    )}
                  </div>
                  {!shippingFetching && !shippingIsOutOfRange && shippingEstimate && shippingEstimate.freeShipDistanceKm > 0 && (
                    <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-kun-products-forest">
                      <Bike className="size-3 shrink-0" />
                      {t("free_ship_within_km", { km: shippingEstimate.freeShipDistanceKm })}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── 2. Payment method ─────────────────────────────────────────── */}
            <PaymentMethodSection
              selected={paymentType}
              onSelect={setPaymentType}
            />

            {/* ── 3. Order total recap ──────────────────────────────────────── */}
            <div className="rounded-2xl border border-black/6 bg-white px-5 py-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)]">
              {type === "delivery" && (
                <div className="mb-3 space-y-2 border-b border-black/6 pb-3 text-sm">
                  <div className="flex items-center justify-between text-foreground/65">
                    <span>{t("temporarily_calculated")}</span>
                    <span className="tabular-nums font-medium text-foreground">{fmtVnd(totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-foreground/65">
                    <span className="flex items-center gap-1">
                      {t("shipping_fee")}
                      {shippingConfig && <ShippingFeeTooltip config={shippingConfig} />}
                    </span>
                    {shippingFetching ? (
                      <span className="text-xs text-muted">{t("group_calculating_ship")}</span>
                    ) : shippingIsOutOfRange ? (
                      <span className="text-xs font-medium text-danger">{t("out_of_delivery_range")}</span>
                    ) : shippingIsFree ? (
                      <span className="text-xs font-semibold uppercase text-kun-products-forest">{t("free")}</span>
                    ) : (
                      <span className="tabular-nums font-medium text-foreground">{fmtVnd(shippingFee)}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {t("group_order_total_label")}
                  </p>
                  <p className="text-xl font-bold tabular-nums text-kun-primary">
                    {fmtVnd(grandTotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ── CTA ───────────────────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting || (type === "delivery" && shippingIsOutOfRange)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("group_saving_delivery")}
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {t("group_save_delivery")}
                </>
              )}
            </button>

            {/* Safe-area spacing for iOS home bar */}
            <div className="h-[max(16px,env(safe-area-inset-bottom))]" />
          </div>
        </div>
      </div>
    </div>
  );
}
