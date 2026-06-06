"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinOff,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  StickyNote,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@heroui/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/config/server";
import { fetchPublicTable, type CreatedOrder, type PublicTableInfo } from "@/services/order/api";
import { fetchProducts } from "@/services/product/api";
import { fetchCategories } from "@/services/category/api";
import type { ApiProduct } from "@/services/product/types";
import type { ApiCategory } from "@/services/category/types";
import { normalizeOptionGroups, computeOptionSurcharge, formatVnd } from "@/lib/product-options";

import { ROUTES } from "@/lib/routes";
import { getDisplayName, getValueLabel } from "@/lib/product-name";

const TABLE_STORAGE_KEY = "kun_table_id";
const PAGE_SIZE = 12;

interface StoreLocationConfig {
  lat: number;
  lng: number;
  radiusMeters: number;
}

interface TableOrderItem {
  localId: string;
  product: ApiProduct;
  quantity: number;
  selectedOptions: Record<string, string>;
  selectedToppingIds: string[];
  unitPrice: number;
  note: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchStoreLocation(): Promise<StoreLocationConfig> {
  const { data } = await api.get<StoreLocationConfig>("/tables/store-location");
  return data;
}

async function submitTableOrder(
  tableId: string,
  paymentType: "cash" | "bank_transfer",
  basket: TableOrderItem[],
): Promise<CreatedOrder> {
  const items = basket.map((b) => ({
    productId: b.product.id,
    quantity: b.quantity,
    price: b.unitPrice,
    ...(Object.keys(b.selectedOptions).length && { options: b.selectedOptions }),
    ...(b.selectedToppingIds.length && {
      extras: b.selectedToppingIds.map((id) => ({ toppingId: id })),
    }),
    ...(b.note && { note: b.note }),
  }));
  const { data } = await api.post<CreatedOrder>(`/tables/${tableId}/order`, {
    paymentType,
    items,
  });
  return data;
}

// ── Location gate screen ──────────────────────────────────────────────────────

type GeoPhase = "checking" | "denied" | "outside" | "ok";

function LocationGate({
  phase,
  distance,
  radiusMeters,
  onRetry,
  onGoHome,
}: {
  phase: Exclude<GeoPhase, "ok">;
  distance?: number;
  radiusMeters?: number;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  const t = useTranslations();

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-soft px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-kun-primary/8">
          <LocateFixed className="size-7 text-kun-primary animate-pulse" />
        </div>
        <p className="font-semibold text-kun-primary">{t("checking_location")}</p>
        <p className="text-sm text-foreground/50">{t("allow_location")}</p>
      </div>
    );
  }

  if (phase === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-soft px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-amber-50">
          <MapPinOff className="size-7 text-amber-500" />
        </div>
        <div>
          <p className="font-bold text-foreground">{t("location_permission_required")}</p>
          <p className="mt-1.5 text-sm text-foreground/55 max-w-xs">
            {t("allow_location_retry")}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-sm font-bold text-white"
          >
            <LocateFixed className="size-4" />
            {t("retry")}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="h-10 w-full rounded-full border border-black/10 text-sm font-semibold text-foreground/60"
          >
            {t("go_home")}
          </button>
        </div>
      </div>
    );
  }

  // outside
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-soft px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
        <MapPin className="size-7 text-red-500" />
      </div>
      <div>
        <p className="font-bold text-foreground">{t("outside_area")}</p>
        <p className="mt-1.5 text-sm text-foreground/55 max-w-xs">
          {t("table_only_instore")}
        </p>
        {distance !== undefined && radiusMeters !== undefined && (
          <p className="mt-3 inline-block rounded-full bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-600">
            {t("table_distance_hint", { distance: Math.round(distance), radius: radiusMeters })}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onGoHome}
        className="flex h-11 items-center justify-center gap-2 rounded-full bg-kun-primary px-8 text-sm font-bold text-white"
      >
        {t("go_home")}
      </button>
    </div>
  );
}

// ── Category Tabs ─────────────────────────────────────────────────────────────

function CategoryTabs({
  categories,
  selectedId,
  onSelect,
}: {
  categories: ApiCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const pillsRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const syncFade = () => {
    const el = pillsRef.current;
    if (!el) return;
    setFadeLeft(el.scrollLeft > 1);
    setFadeRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    syncFade();
    el.addEventListener("scroll", syncFade, { passive: true });
    const ro = new ResizeObserver(syncFade);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", syncFade); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { syncFade(); }, [categories]);

  return (
    <div className="sticky top-[57px] z-20 border-b border-black/[0.06] bg-white">
      <div className="relative px-4 py-2.5">
        {fadeLeft && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-4 z-10 w-10 bg-gradient-to-r from-white to-transparent" />
            <button
              type="button"
              aria-label={t("scroll_left")}
              onClick={() => pillsRef.current?.scrollBy({ left: -180, behavior: "smooth" })}
              className="absolute left-3 top-1/2 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition-colors hover:bg-black/[0.04]"
            >
              <ChevronLeft className="size-3.5 text-foreground/55" />
            </button>
          </>
        )}

        <div
          ref={pillsRef}
          className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max min-w-full items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${selectedId === null
                ? "bg-kun-primary text-white"
                : "bg-black/[0.05] text-foreground/60 hover:bg-black/[0.08]"
                }`}
            >
              {t("all")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${selectedId === cat.id
                  ? "bg-kun-primary text-white"
                  : "bg-black/[0.05] text-foreground/60 hover:bg-black/[0.08]"
                  }`}
              >
                {locale === "vi" ? cat.name : (cat.nameTranslation?.[locale] || cat.name)}
              </button>
            ))}
          </div>
        </div>

        {fadeRight && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-4 z-10 w-10 bg-gradient-to-l from-white to-transparent" />
            <button
              type="button"
              aria-label={t("scroll_right")}
              onClick={() => pillsRef.current?.scrollBy({ left: 180, behavior: "smooth" })}
              className="absolute right-3 top-1/2 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm transition-colors hover:bg-black/[0.04]"
            >
              <ChevronRight className="size-3.5 text-foreground/55" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onPick,
}: {
  product: ApiProduct;
  onPick: (p: ApiProduct) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const img = product.imageUrls[0];
  const sold = product.isSoldOut || !product.isAvailable;
  const disc = product.discountPercent > 0;
  const discPrice = disc ? product.finalPrice : null;

  return (
    <button
      type="button"
      disabled={sold}
      onClick={() => onPick(product)}
      className={`relative flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] transition-all active:scale-[0.98] ${sold
        ? "cursor-not-allowed opacity-50"
        : "hover:shadow-[0_4px_20px_-4px_rgba(26,60,52,0.15)]"
        }`}
    >
      <div className="relative aspect-square w-full bg-surface-card">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={getDisplayName(product, locale)} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Utensils className="size-8 text-black/20" />
          </div>
        )}
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-black/80 px-2.5 py-1 text-[11px] font-bold text-white">
              {t("sold_out")}
            </span>
          </div>
        )}
        {disc && !sold && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            -{product.discountPercent}%
          </span>
        )}
        {!sold && (
          <div className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-kun-primary shadow-sm">
            <Plus className="size-3.5 text-white" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-kun-primary">
          {getDisplayName(product, locale)}
        </p>
        <div className="mt-auto flex items-center gap-1.5">
          {discPrice ? (
            <>
              <span className="text-xs font-bold text-red-600">{formatVnd(discPrice)}</span>
              <span className="text-[10px] text-foreground/40 line-through">
                {formatVnd(product.price)}
              </span>
            </>
          ) : (
            <span className="text-xs font-bold text-kun-primary">{formatVnd(product.price)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Product Pick Modal ────────────────────────────────────────────────────────

function ProductPickModal({
  product,
  onAdd,
  onClose,
}: {
  product: ApiProduct;
  onAdd: (item: Omit<TableOrderItem, "localId">) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const groups = normalizeOptionGroups(product.optionGroups);
  const productToppings = (product.toppings ?? []).filter((tp) => tp.isActive !== false);
  const disc = product.discountPercent > 0;
  const baseEffective = product.finalPrice;

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of groups) {
      const free = g.values.find((v) => v.priceDelta === 0) ?? g.values[0];
      if (free) init[g.name] = free.label;
    }
    return init;
  });
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  const optionSurcharge = computeOptionSurcharge(groups, selectedOptions);
  const toppingSum = productToppings
    .filter((tp) => selectedToppingIds.includes(tp.id))
    .reduce((s, tp) => s + tp.price, 0);
  const unitPrice = baseEffective + optionSurcharge + toppingSum;

  function toggleTopping(id: string) {
    setSelectedToppingIds((prev) => (prev[0] === id ? [] : [id]));
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-[0_-8px_40px_-8px_rgba(0,0,0,0.2)]"
      >
        {/* Drag handle + header */}
        <div className="shrink-0 border-b border-black/[0.06] px-4 pb-3.5 pt-3">
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-black/15" />
          </div>
          <div className="flex items-center gap-3">
            {product.imageUrls[0] && (
              <div className="size-12 shrink-0 overflow-hidden rounded-2xl bg-surface-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrls[0]} alt={getDisplayName(product, locale)} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
                {getDisplayName(product.category, locale)}
              </p>
              <h3 className="truncate text-sm font-bold text-foreground">{getDisplayName(product, locale)}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-foreground/60 hover:bg-black/10"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">

          {/* Options */}
          {groups.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-[#f9fafb] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
                {t("options")}
              </p>
              {groups.map((grp) => (
                <div key={grp.id} className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">
                    {getDisplayName(grp, locale)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {grp.values.map((v) => {
                      const active = selectedOptions[grp.name] === v.label;
                      return (
                        <button
                          key={v.label}
                          type="button"
                          onClick={() => setSelectedOptions((o) => ({ ...o, [grp.name]: v.label }))}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                            active
                              ? "bg-[#1a3c34] text-white"
                              : "bg-white text-foreground/70 ring-1 ring-black/10 hover:ring-[#1a3c34]/30"
                          }`}
                        >
                          {getValueLabel(v, locale)}
                          {v.priceDelta > 0 && (
                            <span className={`ml-1 ${active ? "text-white/70" : "text-foreground/40"}`}>
                              +{formatVnd(v.priceDelta)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Toppings */}
          {productToppings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
                  {t("extra_toppings")}
                </p>
                {selectedToppingIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedToppingIds([])}
                    className="text-[10px] font-semibold text-foreground/40 hover:text-foreground transition-colors"
                  >
                    {t("remove")}
                  </button>
                )}
              </div>
              <div className="max-h-[11rem] space-y-1.5 overflow-y-auto overscroll-contain rounded-2xl border border-black/[0.06] bg-[#f9fafb] p-2">
                {productToppings.map((tp) => {
                  const active = selectedToppingIds.includes(tp.id);
                  return (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => toggleTopping(tp.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-[#1a3c34]/30 bg-[#f0faf6]"
                          : "border-transparent bg-white hover:border-black/[0.08]"
                      }`}
                    >
                      <div className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        active ? "border-[#1a3c34] bg-[#1a3c34]" : "border-black/20 bg-white"
                      }`}>
                        {active && <div className="size-[7px] rounded-full bg-white" />}
                      </div>
                      <span className={`flex-1 text-sm font-medium ${active ? "text-[#1a3c34]" : "text-foreground"}`}>
                        {tp.nameTranslation?.[locale] ?? tp.name}
                      </span>
                      <span className={`text-sm tabular-nums ${active ? "font-semibold text-[#1a3c34]" : "text-foreground/50"}`}>
                        +{formatVnd(tp.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">
              <StickyNote className="size-3" />
              {t("note")}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("note_placeholder_table")}
              maxLength={500}
              className="h-10 w-full rounded-xl border border-black/[0.09] bg-white px-3.5 text-[13px] text-foreground placeholder:text-muted/60 outline-none focus:border-kun-primary focus:ring-2 focus:ring-kun-primary/20 transition"
            />
          </div>

          {/* Price preview */}
          <div className="flex items-center justify-between rounded-2xl bg-[#1a3c34]/[0.08] px-4 py-3">
            <span className="text-sm font-semibold text-[#1a3c34]">{t("total")}</span>
            <span className="text-xl font-bold tabular-nums text-[#1a3c34]">{formatVnd(unitPrice)}</span>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-black/[0.06] bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-black/[0.09] bg-surface-card/40">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-black/[0.06] disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center text-sm font-bold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-black/[0.06]"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted">{qty > 1 ? `× ${qty}` : ""}</p>
              <p className="text-lg font-black tabular-nums text-[#1a3c34]">{formatVnd(unitPrice * qty)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onAdd({ product, quantity: qty, selectedOptions, selectedToppingIds, unitPrice, note });
              onClose();
            }}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-base font-semibold text-white shadow-[0_4px_20px_-4px_rgba(26,60,52,0.45)] transition hover:opacity-90 active:scale-[0.98]"
          >
            <ShoppingBag className="size-5" />
            {t("add_to_cart")}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Order Basket Sheet ────────────────────────────────────────────────────────

function OrderBasketSheet({
  basket,
  tableId,
  tableName,
  onClose,
  onRemoveItem,
  onOrderSuccess,
}: {
  basket: TableOrderItem[];
  tableId: string;
  tableName: string;
  onClose: () => void;
  onRemoveItem: (localId: string) => void;
  onOrderSuccess: (order: CreatedOrder) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [paymentType, setPaymentType] = useState<"cash" | "bank_transfer">("cash");
  const total = basket.reduce((s, b) => s + b.unitPrice * b.quantity, 0);

  const mutation = useMutation({
    mutationFn: () => submitTableOrder(tableId, paymentType, basket),
    onSuccess: onOrderSuccess,
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 350 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90dvh] flex-col rounded-t-3xl bg-white"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-kun-primary" />
            <span className="font-bold text-kun-primary">{t("your_order")}</span>
            <span className="rounded-full bg-kun-primary/10 px-2 py-0.5 text-xs font-bold text-kun-primary">
              {basket.reduce((s, b) => s + b.quantity, 0)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-black/[0.06] text-foreground/60"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-black/[0.05] px-4">
            {basket.map((b) => {
              const toppingNames = b.selectedToppingIds
                .map((id) => {
                  const tp = b.product.toppings?.find((x) => x.id === id);
                  if (!tp) return null;
                  return tp.nameTranslation?.[locale] ?? tp.name;
                })
                .filter(Boolean)
                .join(", ");
              const optionText = Object.entries(b.selectedOptions)
                .map(([, v]) => v)
                .join(", ");
              const subtext = [optionText, toppingNames].filter(Boolean).join(" · ");
              return (
                <div key={b.localId} className="flex items-start gap-3 py-4">
                  {b.product.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.product.imageUrls[0]}
                      alt={getDisplayName(b.product, locale)}
                      className="size-16 shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.06]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-surface-card ring-1 ring-black/[0.06]">
                      <Utensils className="size-5 text-black/20" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                      {getDisplayName(b.product.category, locale)}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {getDisplayName(b.product, locale)}
                    </p>
                    {subtext && (
                      <p className="mt-0.5 truncate text-xs text-foreground/50">{subtext}</p>
                    )}
                    {b.note && (
                      <p className="mt-0.5 truncate text-[11px] italic text-foreground/35">{b.note}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-foreground/50">× {b.quantity}</span>
                      <span className="text-sm font-bold tabular-nums text-kun-products-forest">
                        {formatVnd(b.unitPrice * b.quantity)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(b.localId)}
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/30 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mx-4 my-3 flex items-center gap-2 rounded-xl bg-kun-sage/10 px-3 py-2.5">
            <MapPin className="size-3.5 shrink-0 text-kun-primary/70" />
            <p className="text-xs text-kun-primary/70">
              {t("table_basket_info_prefix")}{" "}
              <span className="font-semibold">{tableName}</span>
              {" "}{t("table_basket_info_suffix")}
            </p>
          </div>

          <div className="px-4 pb-4">
            <p className="mb-2 text-sm font-bold text-kun-primary">{t("payment")}</p>
            <div className="flex gap-2">
              {(["cash", "bank_transfer"] as const).map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentType(pm)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${paymentType === pm
                    ? "border-kun-primary bg-kun-primary/5 text-kun-primary"
                    : "border-black/10 text-foreground/60"
                    }`}
                >
                  {pm === "cash" ? (
                    <><Banknote className="size-4 shrink-0" />{t("cash")}</>
                  ) : (
                    <><Landmark className="size-4 shrink-0" />{t("bank_transfer")}</>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-black/[0.06] bg-white px-4 pb-8 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-foreground/60">{t("total")}</span>
            <span className="text-xl font-bold text-kun-primary">{formatVnd(total)}</span>
          </div>
          {mutation.error && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? t("error_try_again")}
            </p>
          )}
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-kun-primary text-base font-bold text-white shadow-[0_4px_20px_-4px_rgba(26,60,52,0.4)] disabled:opacity-60"
          >
            {mutation.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <ShoppingBag className="size-5" />
                {t("place_order")}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Success Screen ────────────────────────────────────────────────────────────

function SuccessScreen({
  order,
  tableName,
  onNewOrder,
}: {
  order: CreatedOrder;
  tableName: string;
  onNewOrder: () => void;
}) {
  const t = useTranslations();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
        className="flex size-20 items-center justify-center rounded-3xl bg-emerald-50"
      >
        <CheckCircle2 className="size-10 text-emerald-500" />
      </motion.div>
      <div>
        <h2 className="text-2xl font-bold text-kun-primary">{t("order_placed")}</h2>
        <p className="mt-2 text-sm text-foreground/60">
          {t("staff_brings_to_table")}{" "}
          <span className="font-semibold text-kun-primary">{tableName}</span>
        </p>
      </div>
      <div className="rounded-3xl border border-kun-primary/15 bg-kun-sage/10 px-6 py-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-kun-primary/50">{t("order_code")}</p>
        <p className="mt-1 text-2xl font-bold tracking-widest text-kun-primary">
          {order.paymentCode}
        </p>
        <p className="mt-2 text-sm text-foreground/60">
          {t("total")}: <span className="font-bold text-kun-primary">{formatVnd(order.totalAmount)}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onNewOrder}
        className="flex items-center gap-2 rounded-full bg-kun-primary px-8 py-3.5 text-sm font-bold text-white"
      >
        <RotateCcw className="size-4" />
        {t("order_more")}
      </button>
    </motion.div>
  );
}

// ── Main Shell ────────────────────────────────────────────────────────────────

export function TableLandingShell({ tableId }: { tableId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [table, setTable] = useState<PublicTableInfo | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableLoading, setTableLoading] = useState(true);

  // geo
  const [geoPhase, setGeoPhase] = useState<GeoPhase>("checking");
  const [geoDistance, setGeoDistance] = useState<number | undefined>(undefined);
  const [geoRadius, setGeoRadius] = useState<number | undefined>(undefined);
  const [geoRetry, setGeoRetry] = useState(0);

  // menu
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [basket, setBasket] = useState<TableOrderItem[]>([]);
  const [pickingProduct, setPickingProduct] = useState<ApiProduct | null>(null);
  const [showBasket, setShowBasket] = useState(false);
  const [orderResult, setOrderResult] = useState<CreatedOrder | null>(null);

  // Step 1: fetch table info
  useEffect(() => {
    fetchPublicTable(tableId)
      .then((tbl) => {
        setTable(tbl);
        if (tbl.isActive && typeof localStorage !== "undefined") {
          localStorage.setItem(TABLE_STORAGE_KEY, tbl.id);
        }
      })
      .catch(() => setTableError(t("table_not_found")))
      .finally(() => setTableLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Step 2: after table loads and is active, run location check
  useEffect(() => {
    if (!table?.isActive) return;

    async function checkLocation() {
      setGeoPhase("checking");
      let config: StoreLocationConfig;
      try {
        config = await fetchStoreLocation();
      } catch {
        setGeoPhase("ok");
        return;
      }

      if (!config.lat && !config.lng) {
        setGeoPhase("ok");
        return;
      }

      if (!navigator.geolocation) {
        setGeoPhase("ok");
        return;
      }

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 12_000,
            maximumAge: 60_000,
            enableHighAccuracy: false,
          });
        });
        const dist = haversineMeters(
          config.lat,
          config.lng,
          pos.coords.latitude,
          pos.coords.longitude,
        );
        setGeoRadius(config.radiusMeters);
        setGeoDistance(dist);
        if (dist <= config.radiusMeters) {
          setGeoPhase("ok");
        } else {
          setGeoPhase("outside");
        }
      } catch (err: unknown) {
        const code = (err as GeolocationPositionError)?.code;
        if (code === GeolocationPositionError.PERMISSION_DENIED) {
          setGeoPhase("denied");
        } else {
          setGeoPhase("ok");
        }
      }
    }

    void checkLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, geoRetry]);

  // React Query — only enabled after geo passes
  const menuEnabled = geoPhase === "ok" && !!table?.isActive;

  const locale = useLocale()
  const productsQuery = useQuery({
    queryKey: ["products", selectedCategoryId, locale],
    queryFn: () => fetchProducts({ ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}), locale }),
    staleTime: 3 * 60_000,
    enabled: menuEnabled,
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(),
    staleTime: 10 * 60_000,
    enabled: menuEnabled,
  });

  // Reset paging when category changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [selectedCategoryId]);

  // Infinite scroll — reconnects each time visibleCount or data changes
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const total = productsQuery.data?.length ?? 0;
    if (visibleCount >= total) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((c) => c + PAGE_SIZE); },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, productsQuery.data]);
  const basketCount = basket.reduce((s, b) => s + b.quantity, 0);
  const basketTotal = basket.reduce((s, b) => s + b.unitPrice * b.quantity, 0);

  function addToBasket(item: Omit<TableOrderItem, "localId">) {
    setBasket((prev) => [...prev, { ...item, localId: Math.random().toString(36).slice(2) }]);
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (tableLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-soft">
        <Loader2 className="size-8 animate-spin text-kun-primary/40" />
      </div>
    );
  }

  if (tableError || !table) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-soft px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="size-7 text-red-500" />
        </div>
        <p className="font-semibold text-foreground">{tableError ?? t("table_not_found")}</p>
        <Button
          onPress={() => router.push(ROUTES.HOME)}
          className="rounded-full bg-kun-primary px-6 font-semibold text-white"
        >
          {t("go_home")}
        </Button>
      </div>
    );
  }

  if (!table.isActive) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-soft px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-amber-50">
          <AlertCircle className="size-7 text-amber-500" />
        </div>
        <p className="font-semibold text-foreground">{table.name} {t("table_inactive_msg")}</p>
        <p className="text-sm text-foreground/55">{t("contact_staff")}</p>
        <Button
          onPress={() => router.push(ROUTES.HOME)}
          className="rounded-full bg-kun-primary px-6 font-semibold text-white"
        >
          {t("go_home")}
        </Button>
      </div>
    );
  }

  // ── Location gate ────────────────────────────────────────────────────────────

  if (geoPhase !== "ok") {
    return (
      <LocationGate
        phase={geoPhase}
        distance={geoDistance}
        radiusMeters={geoRadius}
        onRetry={() => {
          setGeoPhase("checking");
          setGeoRetry((n) => n + 1);
        }}
        onGoHome={() => router.push(ROUTES.HOME)}
      />
    );
  }

  const area = (table.area ?? "").trim() || t("default_area");

  // ── Success ──────────────────────────────────────────────────────────────────

  if (orderResult) {
    return (
      <div className="min-h-screen bg-surface-soft">
        <SuccessScreen
          order={orderResult}
          tableName={table.name}
          onNewOrder={() => {
            setOrderResult(null);
            setBasket([]);
          }}
        />
      </div>
    );
  }

  // ── Menu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-surface-soft">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-kun-primary">
          <Utensils className="size-4 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-kun-primary">{t('table_header')}: {table.name}</p>
          <p className="flex items-center gap-1 text-[11px] text-foreground/50">
            <MapPin className="size-3 shrink-0" />
            {area}
          </p>
        </div>
      </header>

      {/* Category tabs */}
      <CategoryTabs
        categories={categoriesQuery.data ?? []}
        selectedId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />

      {/* Product grid */}
      <div className="px-4 pb-32 pt-5">
        {productsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-black/[0.06]" />
            ))}
          </div>
        ) : !productsQuery.data?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Utensils className="size-10 text-black/15" />
            <p className="text-sm text-foreground/40">{t("no_items_in_category")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {productsQuery.data.slice(0, visibleCount).map((p) => (
                <ProductCard key={p.id} product={p} onPick={setPickingProduct} />
              ))}
            </div>
            {visibleCount < productsQuery.data.length && (
              <div ref={sentinelRef} className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-kun-primary/40" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating basket button */}
      <AnimatePresence>
        {basketCount > 0 && !showBasket && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="fixed bottom-6 left-4 right-4 z-30"
          >
            <button
              type="button"
              onClick={() => setShowBasket(true)}
              className="flex w-full items-center justify-between rounded-full bg-kun-primary px-5 py-3.5 shadow-[0_8px_32px_-8px_rgba(26,60,52,0.6)]"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="size-5 text-white" />
                  <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-kun-primary">
                    {basketCount}
                  </span>
                </div>
                <span className="text-sm font-bold text-white">{t("view_order")}</span>
              </div>
              <span className="text-sm font-bold text-white/80">{formatVnd(basketTotal)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product pick modal */}
      <AnimatePresence>
        {pickingProduct && (
          <ProductPickModal
            product={pickingProduct}
            onAdd={addToBasket}
            onClose={() => setPickingProduct(null)}
          />
        )}
      </AnimatePresence>

      {/* Basket sheet */}
      <AnimatePresence>
        {showBasket && (
          <OrderBasketSheet
            basket={basket}
            tableId={table.id}
            tableName={table.name}
            onClose={() => setShowBasket(false)}
            onRemoveItem={(localId) =>
              setBasket((prev) => prev.filter((b) => b.localId !== localId))
            }
            onOrderSuccess={(order) => {
              setShowBasket(false);
              setOrderResult(order);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
