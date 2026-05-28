"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Map,
  MapPin,
  Navigation,
  Plus,
  QrCode,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { createAddress, type UserAddress } from "@/services/order/api";
import { useShippingEstimateQuery } from "@/services/shipping/hooks";
import { easeOutSmooth } from "@/app/[locale]/(landing)/components/RevealSection";
import type { GroupOrderState } from "@/services/group-order/api";

const MapLocationPicker = dynamic(
  () =>
    import("@/app/[locale]/checkout/components/MapLocationPicker").then((m) => ({
      default: m.MapLocationPicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-white">
        <Loader2 className="size-8 animate-spin text-kun-primary" />
      </div>
    ),
  },
);

// ── constants ──────────────────────────────────────────────────────────────────

const NEW_ADDRESS_ID = "__new__";

const inputCls =
  "min-h-12 w-full rounded-xl border-0 bg-surface-soft px-4 text-sm text-foreground outline-none ring-1 ring-black/6 transition-shadow focus:ring-2 focus:ring-kun-products-forest/30 placeholder:text-foreground/35";

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

type TabType = "delivery" | "pickup";
type PaymentType = "cash" | "bank_transfer";

const TABS: { id: TabType; label: string; Icon: React.ElementType }[] = [
  { id: "delivery", label: "Giao hàng", Icon: Truck },
  { id: "pickup", label: "Mang về", Icon: ShoppingBag },
];

const PAYMENT_OPTS: { id: PaymentType; label: string; desc: string; Icon: React.ElementType }[] = [
  {
    id: "cash",
    label: "Tiền mặt",
    desc: "Thanh toán trực tiếp khi nhận hàng hoặc tại quán",
    Icon: Banknote,
  },
  {
    id: "bank_transfer",
    label: "Chuyển khoản",
    desc: "Chuyển khoản ngân hàng hoặc quét mã QR",
    Icon: QrCode,
  },
];

// ── types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  state: GroupOrderState;
  savedAddresses: UserAddress[];
  onSave: (payload: {
    type: TabType;
    addressId?: string;
    shippingFee?: number;
    paymentType: PaymentType;
  }) => Promise<void>;
  totalAmount: number;
}

// ── GroupOrderCheckoutModal ───────────────────────────────────────────────────

export function GroupOrderCheckoutModal({
  open,
  onClose,
  state,
  savedAddresses,
  onSave,
  totalAmount,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
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
  const [paymentType, setPaymentType] = useState<PaymentType>(state.paymentType ?? "cash");
  const [showMap, setShowMap] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showNewForm = selectedAddressId === NEW_ADDRESS_ID || savedAddresses.length === 0;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setType((state.type === "table" ? "pickup" : state.type) as TabType);
    setSelectedAddressId(state.address?.id ?? null);
    setNewAddress({ fullAddress: "", lat: null, lng: null });
    setPaymentType(state.paymentType ?? "cash");
    setError(null);
    setGeoError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-select default address if none selected
  useEffect(() => {
    if (!open || type !== "delivery" || selectedAddressId !== null) return;
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (def) setSelectedAddressId(def.id);
  }, [open, type, savedAddresses, selectedAddressId]);

  // ── Shipping estimate ────────────────────────────────────────────────────────

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

  const needsCoords =
    type === "delivery" && shippingLat === null && shippingLng === null;

  const { data: shippingEstimate, isFetching: shippingFetching } =
    useShippingEstimateQuery(shippingLat, shippingLng, totalAmount);

  const shippingFee = type === "delivery" ? (shippingEstimate?.fee ?? 0) : 0;
  const shippingIsFree = type === "delivery" && (shippingEstimate?.isFree ?? false);
  const shippingIsOutOfRange = type === "delivery" && (shippingEstimate?.isOutOfRange ?? false);
  const grandTotal = totalAmount + shippingFee;

  // ── GPS ──────────────────────────────────────────────────────────────────────

  function handleGetGPS() {
    if (!navigator.geolocation) {
      setGeoError("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setNewAddress((p) => ({
          ...p,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }));
      },
      () => {
        setGeoLoading(false);
        setGeoError("Không thể lấy vị trí. Vui lòng cấp quyền định vị.");
      },
      { timeout: 10_000 },
    );
  }

  // ── Step navigation ──────────────────────────────────────────────────────────

  async function handleStep1Next() {
    setError(null);
    if (type === "delivery") {
      if (shippingIsOutOfRange) {
        setError("Địa chỉ nằm ngoài vùng phục vụ của quán.");
        return;
      }
      if (showNewForm && !newAddress.fullAddress.trim()) {
        setError("Vui lòng nhập địa chỉ giao hàng.");
        return;
      }
      if (!showNewForm && !selectedAddressId) {
        setError("Vui lòng chọn địa chỉ giao hàng.");
        return;
      }
    }
    setStep(2);
  }

  // ── Confirm ──────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    setError(null);
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

  const canGoNext =
    !submitting && !(type === "delivery" && shippingIsOutOfRange);

  return (
    <>
      {/* Map picker — highest z-index, covers the modal */}
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

      {/* Full-screen modal */}
      <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-surface-soft">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-black/6 bg-white/95 px-4 py-3.5 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/6 text-foreground/60 transition-colors hover:bg-black/10"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              Đơn nhóm · Bước {step}/2
            </p>
            <h2 className="text-base font-bold text-foreground">
              {step === 1 ? "Thiết lập giao hàng" : "Phương thức thanh toán"}
            </h2>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? "w-6 bg-kun-primary" : "w-3 bg-black/10"
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto pb-[96px] lg:pb-8">
          <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
            <AnimatePresence mode="wait" initial={false}>

              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.24, ease: easeOutSmooth }}
                  className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:gap-8"
                >
                  {/* ── LEFT: Fulfillment setup ─────────────────────────── */}
                  <div className="min-w-0 space-y-4">
                    <section className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                      {/* Tab bar */}
                      <div className="border-b border-black/5 px-5 pt-5">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                          Hình thức nhận hàng
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {TABS.map(({ id, label, Icon }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setType(id);
                                setError(null);
                              }}
                              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition ${type === id
                                  ? "bg-kun-primary text-white"
                                  : "bg-surface-card text-foreground/60 hover:bg-black/6"
                                }`}
                            >
                              <Icon className="size-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tab content */}
                      <div className="px-5 py-5">
                        <AnimatePresence mode="wait" initial={false}>

                          {/* DELIVERY */}
                          {type === "delivery" && (
                            <motion.div
                              key="delivery"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.28, ease: easeOutSmooth }}
                              className="space-y-3"
                            >
                              <div className="flex items-center gap-2 text-foreground">
                                <MapPin className="size-5 shrink-0 text-kun-products-forest" />
                                <h3 className="text-base font-semibold">Địa chỉ giao hàng</h3>
                              </div>

                              {/* Saved addresses */}
                              {savedAddresses.map((addr) => {
                                const isSelected = selectedAddressId === addr.id;
                                return (
                                  <button
                                    key={addr.id}
                                    type="button"
                                    onClick={() => setSelectedAddressId(addr.id)}
                                    className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${isSelected
                                        ? "border-kun-products-forest bg-kun-mint/10"
                                        : "border-transparent bg-surface-soft ring-1 ring-black/6 hover:ring-black/10"
                                      }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div
                                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected
                                            ? "border-kun-products-forest"
                                            : "border-black/25"
                                          }`}
                                      >
                                        {isSelected && (
                                          <div className="size-2 rounded-full bg-kun-products-forest" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium leading-snug text-foreground">
                                          {addr.fullAddress}
                                        </p>
                                        {addr.note && (
                                          <p className="mt-0.5 text-xs text-foreground/50">
                                            {addr.note}
                                          </p>
                                        )}
                                        {addr.isDefault && (
                                          <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                            Mặc định
                                          </span>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-kun-products-forest" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}

                              {/* Add new address option */}
                              {savedAddresses.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAddressId(NEW_ADDRESS_ID)}
                                  className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${showNewForm
                                      ? "border-kun-products-forest bg-kun-mint/10"
                                      : "border-transparent bg-surface-soft ring-1 ring-black/6 hover:ring-black/10"
                                    }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${showNewForm
                                          ? "border-kun-products-forest"
                                          : "border-black/25"
                                        }`}
                                    >
                                      {showNewForm && (
                                        <div className="size-2 rounded-full bg-kun-products-forest" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground/70">
                                      <Plus className="size-3.5" />
                                      Nhập địa chỉ mới
                                    </div>
                                  </div>
                                </button>
                              )}

                              {/* New address form */}
                              <AnimatePresence initial={false}>
                                {showNewForm && (
                                  <motion.div
                                    key="new-addr"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.28, ease: easeOutSmooth }}
                                    className="overflow-hidden"
                                  >
                                    <div className="space-y-3 px-px pb-1 pt-3">
                                      <div>
                                        <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                                          Địa chỉ đầy đủ *
                                        </label>
                                        <div className="mb-2 grid grid-cols-2 gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setShowMap(true)}
                                            className="flex items-center justify-center gap-1.5 rounded-xl border border-black/8 bg-surface-soft py-2.5 text-xs font-semibold text-foreground/65 transition hover:border-kun-products-forest/30 hover:text-kun-products-forest"
                                          >
                                            <Map className="size-3.5" />
                                            Chọn trên bản đồ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleGetGPS}
                                            disabled={geoLoading}
                                            className="flex items-center justify-center gap-1.5 rounded-xl border border-black/8 bg-surface-soft py-2.5 text-xs font-semibold text-foreground/65 transition hover:border-kun-products-forest/30 hover:text-kun-products-forest disabled:opacity-50"
                                          >
                                            {geoLoading ? (
                                              <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                              <Navigation className="size-3.5" />
                                            )}
                                            Vị trí GPS
                                          </button>
                                        </div>
                                        <input
                                          type="text"
                                          placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành"
                                          value={newAddress.fullAddress}
                                          onChange={(e) =>
                                            setNewAddress((p) => ({
                                              ...p,
                                              fullAddress: e.target.value,
                                            }))
                                          }
                                          className={inputCls}
                                          autoComplete="street-address"
                                        />
                                        {geoError && (
                                          <p className="mt-1.5 text-xs text-red-500">{geoError}</p>
                                        )}
                                        {newAddress.lat != null && newAddress.lng != null ? (
                                          <p className="mt-1.5 flex items-center gap-1 text-xs tabular-nums text-kun-products-forest">
                                            <Navigation className="size-3 shrink-0" />
                                            {newAddress.lat.toFixed(5)}, {newAddress.lng.toFixed(5)}
                                          </p>
                                        ) : (
                                          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-foreground/45">
                                            <MapPin className="size-3 shrink-0" />
                                            Chọn bản đồ hoặc GPS để tính phí vận chuyển tự động
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Shipping estimate badge */}
                              <AnimatePresence initial={false}>
                                {(shippingFetching || shippingEstimate) && (
                                  <motion.div
                                    key="shipping-badge"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.22 }}
                                    className="overflow-hidden"
                                  >
                                    <div
                                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${shippingFetching
                                          ? "bg-surface-soft text-muted"
                                          : shippingIsOutOfRange
                                            ? "bg-red-50 text-red-700"
                                            : shippingIsFree
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-[#f0faf6] text-kun-products-forest"
                                        }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {shippingFetching ? (
                                          <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                          <Truck className="size-4" />
                                        )}
                                        <span className="font-medium">
                                          {shippingFetching
                                            ? "Đang tính phí vận chuyển…"
                                            : shippingIsOutOfRange
                                              ? "Ngoài vùng phục vụ"
                                              : `${shippingEstimate!.distanceKm.toFixed(1)} km`}
                                        </span>
                                      </div>
                                      {!shippingFetching && !shippingIsOutOfRange && (
                                        <span className="font-bold tabular-nums">
                                          {shippingIsFree ? "Miễn phí" : fmtVnd(shippingFee)}
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Hint when no coords */}
                              {needsCoords && !showNewForm && (
                                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                                  <MapPin className="size-3.5 shrink-0" />
                                  Địa chỉ này chưa có tọa độ. Phí vận chuyển sẽ được xác nhận sau.
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* PICKUP */}
                          {type === "pickup" && (
                            <motion.div
                              key="pickup"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.28, ease: easeOutSmooth }}
                              className="flex gap-4 rounded-2xl border border-black/6 bg-surface-soft p-5"
                            >
                              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-card text-kun-products-forest ring-1 ring-black/6">
                                <ShoppingBag className="size-6" strokeWidth={1.75} />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-foreground">
                                  Mang về
                                </h3>
                                <p className="mt-1 text-sm text-foreground/65">
                                  Cả nhóm tự đến lấy đơn tại UjCha Matcha &amp; Tea.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </section>
                  </div>

                  {/* ── RIGHT: Order summary (desktop only) ─────────────── */}
                  <div className="hidden lg:block">
                    <div className="sticky top-20 space-y-4 rounded-3xl border border-black/6 bg-white p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Tổng kết đơn
                      </p>

                      {/* Per-participant breakdown */}
                      <div className="space-y-3">
                        {state.participants
                          .filter((p) => p.items.length > 0)
                          .map((p) => (
                            <div key={p.id} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="truncate text-xs font-semibold text-foreground">
                                  {p.name}
                                </span>
                                <span className="shrink-0 pl-2 tabular-nums text-xs font-semibold text-foreground">
                                  {fmtVnd(p.subtotal)}
                                </span>
                              </div>
                              {p.items.map((item) => {
                                const lineTotal =
                                  (item.unitPrice +
                                    (item.toppings?.reduce((s, t) => s + t.price, 0) ?? 0)) *
                                  item.quantity;
                                return (
                                  <div
                                    key={item.id}
                                    className="flex items-start justify-between gap-2 pl-2 text-[11px] text-foreground/50"
                                  >
                                    <span className="min-w-0 truncate">
                                      {item.product?.name ?? "Sản phẩm"} ×{item.quantity}
                                    </span>
                                    <span className="shrink-0 tabular-nums">
                                      {fmtVnd(lineTotal)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                      </div>

                      {/* Price breakdown */}
                      <div className="space-y-2 border-t border-black/6 pt-3 text-sm">
                        <div className="flex justify-between text-foreground/65">
                          <span>Tạm tính</span>
                          <span className="tabular-nums font-medium text-foreground">
                            {fmtVnd(totalAmount)}
                          </span>
                        </div>
                        {type === "delivery" && (
                          <div className="flex items-center justify-between text-foreground/65">
                            <span>Phí vận chuyển</span>
                            {shippingFetching ? (
                              <Loader2 className="size-3.5 animate-spin text-muted" />
                            ) : shippingIsFree ? (
                              <span className="text-xs font-bold text-emerald-600">Miễn phí</span>
                            ) : (
                              <span className="tabular-nums font-medium">{fmtVnd(shippingFee)}</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-baseline justify-between border-t border-black/6 pt-2">
                          <span className="font-semibold text-foreground/70">Thành tiền</span>
                          <span className="text-2xl font-bold tabular-nums text-kun-primary">
                            {fmtVnd(grandTotal)}
                          </span>
                        </div>
                      </div>

                      {error && (
                        <div className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleStep1Next()}
                        disabled={!canGoNext}
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        Tiếp tục
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ── STEP 2: Payment method ───────────────────────────── */
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.24, ease: easeOutSmooth }}
                  className="mx-auto max-w-lg space-y-4"
                >
                  <div className="overflow-hidden rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)]">
                    <div className="border-b border-black/5 px-5 pt-5 pb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Phương thức thanh toán
                      </p>
                      <p className="mt-1 text-sm text-foreground/60">
                        {state.paymentMode === "host_pays"
                          ? "Chủ nhóm sẽ thanh toán toàn bộ đơn hàng"
                          : "Chọn cách bạn muốn thanh toán phần của mình"}
                      </p>
                    </div>

                    <div className="space-y-3 px-5 py-5">
                      {PAYMENT_OPTS.map(({ id, label, desc, Icon }) => {
                        const isSelected = paymentType === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPaymentType(id)}
                            className={`w-full rounded-2xl border-2 px-4 py-4 text-left transition-all ${isSelected
                                ? "border-kun-products-forest bg-kun-mint/10"
                                : "border-transparent bg-surface-soft ring-1 ring-black/6 hover:ring-black/10"
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div
                                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${isSelected
                                    ? "bg-kun-products-forest/12 text-kun-products-forest"
                                    : "bg-surface-card text-foreground/40"
                                  }`}
                              >
                                <Icon className="size-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-sm font-semibold ${isSelected ? "text-kun-products-forest" : "text-foreground"
                                    }`}
                                >
                                  {label}
                                </p>
                                <p className="mt-0.5 text-xs leading-snug text-foreground/50">
                                  {desc}
                                </p>
                              </div>
                              <div
                                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isSelected
                                    ? "border-kun-products-forest bg-kun-products-forest"
                                    : "border-black/20"
                                  }`}
                              >
                                {isSelected && (
                                  <Check className="size-3 text-white" strokeWidth={3} />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary recap */}
                  <div className="rounded-2xl border border-black/6 bg-white px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground/60">Tổng thanh toán</span>
                      <span className="text-lg font-bold tabular-nums text-kun-primary">
                        {fmtVnd(grandTotal)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground/40">
                      {type === "delivery" ? (
                        <Truck className="size-3 shrink-0" />
                      ) : (
                        <ShoppingBag className="size-3 shrink-0" />
                      )}
                      {type === "delivery" ? "Giao hàng" : "Mang về"}
                      {type === "delivery" && shippingFee > 0 && (
                        <span>· Phí ship {fmtVnd(shippingFee)}</span>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-600">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Mobile sticky bar ──────────────────────────────────────────────── */}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-black/6 bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)] backdrop-blur-sm lg:hidden">
          {error && (
            <div className="mb-2.5 flex items-start gap-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                Thành tiền
              </p>
              <p className="text-xl font-bold tabular-nums text-kun-primary">
                {fmtVnd(grandTotal)}
              </p>
            </div>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => void handleStep1Next()}
                disabled={!canGoNext}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Tiếp tục
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang lưu…
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Xác nhận
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Desktop step-2 confirm inside scrollable area (already in sticky sidebar for step 1) */}
        {step === 2 && (
          <div className="hidden lg:block">
            <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4">
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(26,60,52,0.4)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang lưu…
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Xác nhận thiết lập
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
