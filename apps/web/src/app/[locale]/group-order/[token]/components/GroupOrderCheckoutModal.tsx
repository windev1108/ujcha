"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  Check,
  CheckCircle2,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Plus,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  // ── GPS ───────────────────────────────────────────────────────────────────

  function handleGetGPS() {
    if (!navigator.geolocation) {
      setGeoError(t("group_geo_not_supported"));
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setNewAddress((p) => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude }));
      },
      () => {
        setGeoLoading(false);
        setGeoError(t("group_geo_error"));
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
      await onSave({ type, addressId, shippingFee: type === "delivery" ? shippingFee : 0 });
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

      <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#f7f7f7]">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-black/6 bg-white/95 px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/6 text-foreground/60 transition-colors hover:bg-black/10"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
              {t("group_checkout_eyebrow")}
            </p>
            <h2 className="text-base font-bold text-foreground">{t("group_checkout_title")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-black/6"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto pb-[100px]">
          <div className="container mx-auto max-w-2xl px-4 py-6 sm:px-6">
            <div className="space-y-4">

              {/* Type tabs */}
              <div className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                <div className="border-b border-black/5 px-5 pt-5 pb-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
                    {t("group_fulfillment_label")}
                  </p>
                  <div className="flex gap-2">
                    {TABS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setType(id); setError(null); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition ${type === id
                          ? "bg-[#1a3c34] text-white shadow-sm"
                          : "bg-[#f7f7f7] text-foreground/60 hover:bg-black/6"
                          }`}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div className="px-5 py-5">
                  <AnimatePresence mode="wait" initial={false}>
                    {type === "delivery" ? (
                      <motion.div
                        key="delivery"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: easeOutSmooth }}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="size-4 shrink-0 text-[#26634d]" />
                          <p className="text-sm font-semibold text-foreground">{t("delivery_address_title")}</p>
                        </div>

                        {savedAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => setSelectedAddressId(addr.id)}
                              className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${isSelected
                                ? "border-[#26634d] bg-[#f0faf6]"
                                : "border-transparent bg-[#f7f7f7] ring-1 ring-black/6 hover:ring-black/10"
                                }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-[#26634d]" : "border-black/25"}`}>
                                  {isSelected && <div className="size-2 rounded-full bg-[#26634d]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium leading-snug text-foreground">{addr.fullAddress}</p>
                                  {addr.note && <p className="mt-0.5 text-xs text-foreground/50">{addr.note}</p>}
                                  {addr.isDefault && (
                                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                      {t("group_default_addr_badge")}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#26634d]" />}
                              </div>
                            </button>
                          );
                        })}

                        {savedAddresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedAddressId(NEW_ADDRESS_ID)}
                            className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${showNewForm
                              ? "border-[#26634d] bg-[#f0faf6]"
                              : "border-transparent bg-[#f7f7f7] ring-1 ring-black/6 hover:ring-black/10"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${showNewForm ? "border-[#26634d]" : "border-black/25"}`}>
                                {showNewForm && <div className="size-2 rounded-full bg-[#26634d]" />}
                              </div>
                              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
                                <Plus className="size-3.5" />
                                {t("add_new_address_option")}
                              </div>
                            </div>
                          </button>
                        )}

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
                              <div className="space-y-3 px-px pb-1 pt-3">
                                <label className="block text-xs font-medium text-foreground/70">
                                  {t("full_address")}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowMap(true)}
                                    className="flex items-center justify-center gap-1.5 rounded-xl border border-black/8 bg-[#f7f7f7] py-2.5 text-xs font-semibold text-foreground/65 transition hover:border-[#26634d]/30 hover:text-[#26634d]"
                                  >
                                    <Map className="size-3.5" />
                                    {t("group_pick_on_map")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleGetGPS}
                                    disabled={geoLoading}
                                    className="flex items-center justify-center gap-1.5 rounded-xl border border-black/8 bg-[#f7f7f7] py-2.5 text-xs font-semibold text-foreground/65 transition hover:border-[#26634d]/30 hover:text-[#26634d] disabled:opacity-50"
                                  >
                                    {geoLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" />}
                                    {t("group_gps_btn")}
                                  </button>
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
                                {newAddress.lat != null && newAddress.lng != null ? (
                                  <p className="flex items-center gap-1 text-xs tabular-nums text-[#26634d]">
                                    <Navigation className="size-3 shrink-0" />
                                    {newAddress.lat.toFixed(5)}, {newAddress.lng.toFixed(5)}
                                  </p>
                                ) : (
                                  <p className="flex items-center gap-1 text-[11px] text-foreground/45">
                                    <MapPin className="size-3 shrink-0" />
                                    {t("group_map_gps_hint")}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Shipping estimate */}
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
                              <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${shippingFetching
                                ? "bg-[#f7f7f7] text-foreground/50"
                                : shippingIsOutOfRange
                                  ? "bg-red-50 text-red-700"
                                  : shippingIsFree
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-[#f0faf6] text-[#26634d]"
                                }`}>
                                <div className="flex items-center gap-1.5">
                                  {shippingFetching
                                    ? <Loader2 className="size-4 animate-spin" />
                                    : <Bike className="size-4" />
                                  }
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
                      </motion.div>
                    ) : (
                      <motion.div
                        key="pickup"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: easeOutSmooth }}
                        className="flex gap-4 rounded-2xl border border-black/6 bg-[#f7f7f7] p-5"
                      >
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#26634d] ring-1 ring-black/6">
                          <ShoppingBag className="size-6" strokeWidth={1.75} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-foreground">{t("group_pickup_title")}</h3>
                          <p className="mt-1 text-sm text-foreground/65">
                            {t("group_pickup_desc")}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Order total recap */}
              <div className="flex items-center justify-between rounded-2xl border border-black/6 bg-white px-4 py-3.5">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
                    {t("group_order_total_label")}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-[#1a3c34]">
                    {fmtVnd(grandTotal)}
                  </p>
                </div>
                {type === "delivery" && !shippingFetching && shippingFee > 0 && (
                  <p className="text-xs text-foreground/50">
                    {t("group_incl_ship", { fee: fmtVnd(shippingFee) })}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/6 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || (type === "delivery" && shippingIsOutOfRange)}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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
        </div>
      </div>
    </>
  );
}
