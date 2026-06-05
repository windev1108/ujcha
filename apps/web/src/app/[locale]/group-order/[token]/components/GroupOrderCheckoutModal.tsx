"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Plus,
  QrCode,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { createAddress, type UserAddress } from "@/services/order/api";
import { useShippingEstimateQuery } from "@/services/shipping/hooks";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import type { GroupOrderState } from "@/services/group-order/api";
import { useTranslations } from "next-intl";

const MapLocationPicker = dynamic(
  () =>
    import("@/app/[locale]/checkout/components/MapLocationPicker").then((m) => ({
      default: m.MapLocationPicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white">
        <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
      </div>
    ),
  },
);

const NEW_ADDRESS_ID = "__new__";

const inputCls =
  "min-h-12 w-full rounded-xl border-0 bg-[#f7f7f7] px-4 text-sm text-foreground outline-none ring-1 ring-black/6 transition-shadow focus:ring-2 focus:ring-[#26634d]/30 placeholder:text-foreground/35";

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type TabType = "delivery" | "pickup";

interface Props {
  open: boolean;
  onClose: () => void;
  state: GroupOrderState;
  savedAddresses: UserAddress[];
  onSave: (payload: {
    type: TabType;
    addressId?: string;
    shippingFee?: number;
    paymentType: "cash" | "bank_transfer";
  }) => Promise<void>;
  totalAmount: number;
}

export function GroupOrderCheckoutModal({
  open,
  onClose,
  state,
  savedAddresses,
  onSave,
  totalAmount,
}: Props) {
  const t = useTranslations();
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
  const [newAddress, setNewAddress] = useState({
    fullAddress: "",
    lat: null as number | null,
    lng: null as number | null,
  });
  const [paymentType, setPaymentType] = useState<"cash" | "bank_transfer">(
    state.paymentType ?? "cash",
  );
  const [showMap, setShowMap] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showNewForm = selectedAddressId === NEW_ADDRESS_ID || savedAddresses.length === 0;

  useEffect(() => {
    if (!open) return;
    setType((state.type === "table" ? "pickup" : state.type) as TabType);
    setSelectedAddressId(state.address?.id ?? null);
    setNewAddress({ fullAddress: "", lat: null, lng: null });
    setPaymentType(state.paymentType ?? "cash");
    setError(null);
    setGeoError(null);
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
    if (showNewForm) return newAddress.lat;
    const addr = savedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lat && addr.lat !== 0 ? addr.lat : null;
  }, [type, showNewForm, newAddress.lat, savedAddresses, selectedAddressId]);

  const shippingLng = useMemo(() => {
    if (type !== "delivery") return null;
    if (showNewForm) return newAddress.lng;
    const addr = savedAddresses.find((a) => a.id === selectedAddressId);
    return addr?.lng && addr.lng !== 0 ? addr.lng : null;
  }, [type, showNewForm, newAddress.lng, savedAddresses, selectedAddressId]);

  const needsCoords = type === "delivery" && shippingLat === null && shippingLng === null;

  const { data: shippingEstimate, isFetching: shippingFetching } =
    useShippingEstimateQuery(shippingLat, shippingLng, totalAmount);

  const shippingFee = type === "delivery" ? (shippingEstimate?.fee ?? 0) : 0;
  const shippingIsFree = type === "delivery" && (shippingEstimate?.isFree ?? false);
  const shippingIsOutOfRange = type === "delivery" && (shippingEstimate?.isOutOfRange ?? false);
  const grandTotal = totalAmount + shippingFee;

  // ── GPS + reverse-geocode ──────────────────────────────────────────────────

  function handleGetGPS() {
    if (!navigator.geolocation) {
      setGeoError(t("browser_no_location"));
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setNewAddress((p) => ({ ...p, lat, lng }));
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
            { headers: { "User-Agent": "KunRituals/1.0" } },
          );
          const data = (await resp.json()) as { display_name?: string };
          if (data.display_name) {
            setNewAddress((p) => ({ ...p, fullAddress: data.display_name! }));
          }
        } catch { /* ignore geocode errors */ }
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setGeoError(t("location_permission_denied"));
      },
      { timeout: 10_000 },
    );
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setError(null);

    if (type === "delivery") {
      if (shippingIsOutOfRange) {
        setError(t("error_delivery_out_of_range"));
        return;
      }
      if (showNewForm && !newAddress.fullAddress.trim()) {
        setError(t("error_enter_delivery_address"));
        return;
      }
      if (!showNewForm && !selectedAddressId) {
        setError(t("error_select_address"));
        return;
      }
    }

    setSubmitting(true);
    try {
      let addressId: string | undefined;
      if (type === "delivery") {
        if (showNewForm) {
          const created = await createAddress({
            fullAddress: newAddress.fullAddress.trim(),
            lat: newAddress.lat ?? 0,
            lng: newAddress.lng ?? 0,
          });
          addressId = created.id;
        } else {
          addressId = selectedAddressId ?? undefined;
        }
      }
      await onSave({
        type,
        addressId,
        shippingFee: type === "delivery" ? shippingFee : 0,
        paymentType,
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

  const paymentOpts: { id: "cash" | "bank_transfer"; labelKey: string; descKey: string; Icon: React.ElementType }[] = [
    { id: "cash", labelKey: "cash", descKey: "cash_desc", Icon: Banknote },
    { id: "bank_transfer", labelKey: "bank_transfer", descKey: "bank_transfer_desc", Icon: QrCode },
  ];

  return (
    <>
      {showMap && (
        <MapLocationPicker
          initialLat={newAddress.lat}
          initialLng={newAddress.lng}
          onConfirm={(lat, lng, address) => {
            setNewAddress({ fullAddress: address, lat, lng });
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-surface-soft">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-black/6 bg-white px-4 py-3.5 shadow-sm sm:px-6">
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

        {/* Scrollable body — CTA lives inside, NOT fixed */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
            <div className="space-y-4 sm:space-y-5">

              {/* ── 1. Fulfillment type ───────────────────────────────────── */}
              <section className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                <div className="space-y-4 p-5 sm:p-6">
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                      {t("group_fulfillment_label")}
                    </p>
                    <p className="text-lg font-semibold text-foreground">{t("fulfillment_info")}</p>
                  </div>
                  <div className="flex gap-2">
                    {TABS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setType(id); setError(null); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors ${
                          type === id
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
              </section>

              {/* ── 2. Delivery address / Pickup info ─────────────────────── */}
              <AnimatePresence mode="wait" initial={false}>
                {type === "delivery" ? (
                  <motion.section
                    key="delivery"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: easeOutSmooth }}
                    className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]"
                  >
                    <div className="space-y-4 p-5 sm:p-6">
                      <div>
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                          {t("delivery_type")}
                        </p>
                        <div className="flex items-center gap-2">
                          <MapPin className="size-5 shrink-0 text-kun-products-forest" aria-hidden />
                          <p className="text-lg font-semibold text-foreground">{t("delivery_address_title")}</p>
                        </div>
                      </div>

                      {/* Saved addresses */}
                      <div className="space-y-2">
                        {savedAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => setSelectedAddressId(addr.id)}
                              className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                                isSelected
                                  ? "border-kun-products-forest bg-kun-mint/10"
                                  : "border-transparent bg-surface-card ring-1 ring-black/6 hover:ring-black/10"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-kun-products-forest" : "border-black/25"}`}>
                                  {isSelected && <div className="size-2 rounded-full bg-kun-products-forest" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-snug text-foreground">{addr.fullAddress}</p>
                                  {addr.note && <p className="mt-0.5 text-xs text-foreground/50">{addr.note}</p>}
                                  {addr.isDefault && (
                                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                      {t("default")}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-kun-products-forest" />}
                              </div>
                            </button>
                          );
                        })}

                        {/* Add new address option */}
                        {savedAddresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedAddressId(NEW_ADDRESS_ID)}
                            className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                              showNewForm
                                ? "border-kun-products-forest bg-kun-mint/10"
                                : "border-transparent bg-surface-card ring-1 ring-black/6 hover:ring-black/10"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${showNewForm ? "border-kun-products-forest" : "border-black/25"}`}>
                                {showNewForm && <div className="size-2 rounded-full bg-kun-products-forest" />}
                              </div>
                              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
                                <Plus className="size-3.5" />
                                {t("add_new_address_option")}
                              </div>
                            </div>
                          </button>
                        )}
                      </div>

                      {/* New address form — animated expand */}
                      <AnimatePresence initial={false}>
                        {showNewForm && (
                          <motion.div
                            key="new-addr"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: easeOutSmooth }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-3 px-px pb-1 pt-2">
                              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                <label className="text-xs font-medium text-foreground/70">
                                  {t("full_address")}
                                </label>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setShowMap(true)}
                                    className="flex items-center gap-1 text-[11px] font-medium text-kun-products-forest hover:opacity-80"
                                  >
                                    <Map className="size-3" />
                                    {t("select_on_map")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleGetGPS}
                                    disabled={geoLoading}
                                    className="flex items-center gap-1 text-[11px] font-medium text-kun-products-forest hover:opacity-80 disabled:opacity-50"
                                  >
                                    {geoLoading ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Navigation className="size-3" />
                                    )}
                                    {t("gps")}
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder={t("address_placeholder")}
                                value={newAddress.fullAddress}
                                onChange={(e) => setNewAddress((p) => ({ ...p, fullAddress: e.target.value }))}
                                className={inputCls}
                                autoComplete="street-address"
                              />
                              {geoError && <p className="text-xs text-red-500">{geoError}</p>}
                              {newAddress.lat != null && newAddress.lng != null && (
                                <p className="flex items-center gap-1 text-xs tabular-nums text-kun-products-forest">
                                  <Navigation className="size-3 shrink-0" />
                                  {newAddress.lat.toFixed(5)}, {newAddress.lng.toFixed(5)}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Shipping estimate badge */}
                      <AnimatePresence initial={false}>
                        {(shippingFetching || shippingEstimate) && (
                          <motion.div
                            key="ship-badge"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
                              shippingFetching
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
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {needsCoords && !showNewForm && (
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                          <MapPin className="size-3.5 shrink-0" />
                          {t("group_no_coords_warn")}
                        </div>
                      )}
                    </div>
                  </motion.section>
                ) : (
                  <motion.section
                    key="pickup"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: easeOutSmooth }}
                    className="flex gap-4 rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] sm:p-6"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-card text-kun-products-forest ring-1 ring-black/6">
                      <ShoppingBag className="size-6" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{t("group_pickup_title")}</h3>
                      <p className="mt-1 text-sm text-foreground/65">{t("group_pickup_desc")}</p>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* ── 3. Payment method ─────────────────────────────────────── */}
              <section className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                <div className="space-y-4 p-5 sm:p-6">
                  <div>
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                      {t("payment")}
                    </p>
                    <p className="text-lg font-semibold text-foreground">{t("payment_method")}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentOpts.map(({ id, labelKey, descKey, Icon }) => {
                      const active = paymentType === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setPaymentType(id)}
                          className={`rounded-3xl border-2 p-4 text-left transition-colors sm:p-5 ${
                            active
                              ? "border-kun-products-forest bg-kun-mint/15"
                              : "border-transparent bg-surface-card ring-1 ring-black/6 hover:ring-black/10"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon
                              className={`mt-0.5 size-5 shrink-0 ${active ? "text-kun-products-forest" : "text-foreground/50"}`}
                              strokeWidth={1.5}
                            />
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold ${active ? "text-kun-products-forest" : "text-foreground/80"}`}>
                                {t(labelKey)}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-snug text-foreground/55">
                                {t(descKey)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {paymentType === "bank_transfer" && (
                    <p className="text-center text-xs text-foreground/55">{t("qr_info")}</p>
                  )}
                </div>
              </section>

              {/* ── 4. Order total recap ──────────────────────────────────── */}
              <div className="flex items-center justify-between rounded-2xl border border-black/6 bg-white px-5 py-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)]">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                    {t("group_order_total_label")}
                  </p>
                  <p className="text-xl font-bold tabular-nums text-kun-primary">
                    {fmtVnd(grandTotal)}
                  </p>
                </div>
                {type === "delivery" && !shippingFetching && shippingFee > 0 && (
                  <p className="text-xs text-foreground/50">
                    {t("group_incl_ship", { fee: fmtVnd(shippingFee) })}
                  </p>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── CTA — naturally in flow, NOT fixed ───────────────────── */}
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
    </>
  );
}
