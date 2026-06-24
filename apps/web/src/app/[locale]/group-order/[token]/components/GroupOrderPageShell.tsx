"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { motion, AnimatePresence } from "motion/react";
import { io, Socket } from "socket.io-client";
import Image from "next/image";
import {
  Banknote,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Info,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Minus,
  Pencil,
  Plus,
  QrCode,
  Search,
  Share2,
  ShoppingBag,
  StarIcon,
  StickyNote,
  Trash2,
  Truck,
  UserX,
  Users,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { Button, Card, CardContent } from "@heroui/react";
import { env } from "@/config/env";
import { useAuthStore } from "@/store/auth-store";
import { useProductsQuery } from "@/services/product/hooks";
import type { ApiProduct } from "@/services/product/types";
import { useCategoriesQuery } from "@/services/category/hooks";
import { normalizeOptionGroups, computeOptionSurcharge, formatVnd, formatOptionLabel } from "@/lib/product-options";

import { useAddressesQuery } from "@/services/order/hooks";
import { createAddress } from "@/services/order/api";
import { useShippingEstimateQuery, usePublicShippingConfigQuery } from "@/services/shipping/hooks";
import { usePublicPaymentConfigQuery } from "@/services/payment-config/hooks";
import { useProfileQuery } from "@/services/profile/hooks";
import { usePublicStoreLocationQuery } from "@/services/store/hooks";
import { CheckoutFulfillmentSection } from "@/app/[locale]/checkout/components/CheckoutFulfillmentSection";
import { CHECKOUT_TAB } from "@/app/[locale]/checkout/components/checkout-tab";
import type { DeliveryForm, PickupForm } from "@/app/[locale]/checkout/components/checkout-types";
import { ShippingFeeTooltip } from "@/components/common/ShippingFeeTooltip";
import { clearGroupOrderSession } from "@/hooks/useGroupOrderSessions";
import {
  fetchGroupOrder,
  joinGroupOrder,
  updateGroupOrderItems,
  markGroupOrderReady,
  lockGroupOrder,
  setGroupOrderFulfillment,
  checkoutHostPays,
  confirmParticipantPaid,
  checkoutSplitCash,
  kickGroupOrderParticipant,
  leaveGroupOrder,
  dissolveGroupOrder,
  fetchGroupOrderConfig,
  type GroupOrderState,
  type GroupOrderItem,
  type GroupDiscountTier,
} from "@/services/group-order/api";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { getDisplayName } from "@/lib/product-name";
import { getDeviceId } from "@/hooks/useDeviceId";

const SESSION_KEY = (token: string) => `group_order_session_${token}`;
const PARTICIPANT_KEY = (token: string) => `group_order_participant_${token}`;
const JOIN_LOCK_KEY = (token: string) => `group_order_joining_${token}`;
const JOIN_LOCK_TTL = 15_000;
const GROUP_ORDER_BC = "ujcha-group-order";

/** Kiểm tra tab trùng lặp qua BroadcastChannel. Trả về `true` nếu phát hiện tab khác đã join token này. */
async function detectDuplicateTab(token: string): Promise<boolean> {
  if (typeof BroadcastChannel === "undefined") return false;
  return new Promise((resolve) => {
    const bc = new BroadcastChannel(GROUP_ORDER_BC);
    let found = false;
    const handler = (e: MessageEvent<{ type: string; token: string }>) => {
      if (e.data.type === "ALREADY_HERE" && e.data.token === token) {
        found = true;
        bc.removeEventListener("message", handler);
        bc.close();
        resolve(true);
      }
    };
    bc.addEventListener("message", handler);
    bc.postMessage({ type: "CHECK_TOKEN", token });
    setTimeout(() => {
      if (!found) {
        bc.removeEventListener("message", handler);
        bc.close();
        resolve(false);
      }
    }, 250);
  });
}


function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function resolveDiscount(participantCount: number, tiers: GroupDiscountTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.minParticipants - a.minParticipants);
  return sorted.find((t) => participantCount >= t.minParticipants)?.discountPercent ?? 0;
}

function StatusBadge({ status }: { status: GroupOrderState["status"] }) {
  const t = useTranslations();
  const map: Record<GroupOrderState["status"], { label: string; cls: string }> = {
    collecting: { label: t("group_status_collecting"), cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    locked: { label: t("group_status_locked"), cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    completed: { label: t("status_completed"), cls: "bg-green-50 text-green-700 ring-green-200" },
    cancelled: { label: t("status_cancelled"), cls: "bg-red-50 text-red-600 ring-red-200" },
  };
  const { label, cls } = map[status] ?? map.collecting;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

type ToppingDraft = { toppingId: string; name: string; price: number; nameTranslation?: Record<string, string> };
type DraftValue = { quantity: number; selectedOptions: Record<string, string>; toppings: ToppingDraft[]; note?: string };
type DraftItem = DraftValue & { productId: string };

// ── ProductCustomizeSheet ─────────────────────────────────────────────────────

function ProductCustomizeSheet({
  product,
  initial,
  onConfirm,
  onClose,
}: {
  product: ApiProduct;
  initial?: DraftValue;
  onConfirm: (value: DraftValue) => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const optionGroups = normalizeOptionGroups(product.optionGroups);
  const toppings = (product.toppings ?? []).filter((t) => t.isActive !== false);
  const basePrice = product.finalPrice ?? parseFloat(product.price);

  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [note, setNote] = useState(initial?.note ?? "");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const opts: Record<string, string> = {};
    for (const grp of optionGroups) {
      opts[grp.name] = initial?.selectedOptions?.[grp.name] ?? grp.values[0]?.label ?? "";
    }
    return opts;
  });
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(
    () => new Set(initial?.toppings?.map((t) => t.toppingId) ?? []),
  );

  const optionSurcharge = computeOptionSurcharge(optionGroups, selectedOptions);
  const toppingTotal = toppings
    .filter((t) => selectedToppings.has(t.id))
    .reduce((s, t) => s + t.price, 0);
  const unitPrice = basePrice + optionSurcharge + toppingTotal;

  const toggleTopping = (id: string, checked: boolean) => {
    setSelectedToppings(checked ? new Set([id]) : new Set());
  };

  const handleConfirm = () => {
    onConfirm({
      quantity,
      selectedOptions,
      toppings: toppings
        .filter((t) => selectedToppings.has(t.id))
        .map((t) => ({ toppingId: t.id, name: t.name, price: t.price, nameTranslation: t.nameTranslation })),
      note: note.trim() || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-black/6 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/6 text-foreground/60 hover:bg-black/10"
        >
          <X className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{t("group_options_eyebrow")}</p>
          <h3 className="truncate text-sm font-bold text-foreground">{getDisplayName(product, locale)}</h3>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {optionGroups.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-black/6 bg-[#f9fafb] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">{t("group_selection_eyebrow")}</p>
            {optionGroups.map((grp) => (
              <div key={grp.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">
                  {grp.nameTranslation?.[locale] ?? grp.name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {grp.values.map((v) => {
                    const active = selectedOptions[grp.name] === v.label;
                    const displayLabel = v.nameTranslation?.[locale] ?? v.label;
                    return (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [grp.name]: v.label }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${active
                          ? "bg-[#1a3c34] text-white"
                          : "bg-white text-foreground/70 ring-1 ring-black/10 hover:ring-[#1a3c34]/30"
                          }`}
                      >
                        {displayLabel}
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

        {toppings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">{t("group_toppings_eyebrow")}</p>
              {selectedToppings.size > 0 && (
                <p className="text-[10px] font-semibold text-foreground/40">
                  {t("group_selected_count", { count: selectedToppings.size })}
                </p>
              )}
            </div>
            <div className="max-h-44 overflow-y-auto rounded-2xl border border-black/6 bg-[#f9fafb] p-2">
              {toppings.map((top) => {
                const active = selectedToppings.has(top.id);
                return (
                  <button
                    key={top.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggleTopping(top.id, !active)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${active
                      ? "border-[#1a3c34]/30 bg-[#f0faf6]"
                      : "border-transparent bg-white hover:border-black/8"
                      }`}
                  >
                    <div className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors ${active ? "border-[#1a3c34] bg-[#1a3c34]" : "border-black/20 bg-white"}`}>
                      {active && <Check className="size-2.5 text-white" />}
                    </div>
                    <span className={`flex-1 text-sm font-medium ${active ? "text-[#1a3c34]" : "text-foreground"}`}>
                      {top.nameTranslation?.[locale] ?? top.name}
                    </span>
                    <span className={`text-sm tabular-nums ${active ? "font-semibold text-[#1a3c34]" : "text-foreground/50"}`}>
                      +{formatVnd(top.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">{t("group_quantity_label")}</p>
          <div className="inline-flex items-center rounded-full border border-black/8 bg-[#f7f7f7]">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-black/6 disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center text-sm font-bold tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="flex size-10 items-center justify-center rounded-full text-foreground transition hover:bg-black/6"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">{t("group_note_label")}</p>
          <div className="flex items-start gap-2 rounded-2xl border border-black/8 bg-[#f9fafb] px-3 py-2.5 focus-within:border-[#1a3c34]/30">
            <StickyNote className="mt-0.5 size-3.5 shrink-0 text-foreground/35" />
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("group_note_placeholder")}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-foreground/35 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#1a3c34]/8 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#1a3c34]">{t("group_unit_price_label")}</span>
            {quantity > 1 && (
              <span className="text-[11px] text-[#1a3c34]/55">{quantity} × {fmtVnd(unitPrice)}</span>
            )}
          </div>
          <span className="text-xl font-bold tabular-nums text-[#1a3c34]">{fmtVnd(unitPrice * quantity)}</span>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/6 px-5 py-4">
        <Button
          className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-base font-semibold text-white"
          onPress={handleConfirm}
        >
          <Check className="size-5" />
          {initial ? t("group_update_item_btn") : t("group_add_item_btn")}
        </Button>
      </div>
    </motion.div>
  );
}

// ── ProductPickerDrawer ───────────────────────────────────────────────────────

function ProductPickerDrawer({
  open,
  onClose,
  initialItems,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initialItems: GroupOrderItem[];
  onSave: (items: DraftItem[]) => Promise<void>;
  saving: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const [draft, setDraft] = useState<Map<string, DraftValue>>(() => {
    const m = new Map<string, DraftValue>();
    initialItems.forEach((item) =>
      m.set(item.productId, {
        quantity: item.quantity,
        selectedOptions: item.selectedOptions ?? {},
        toppings: item.toppings ?? [],
        note: item.note ?? undefined,
      }),
    );
    return m;
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [customizeTarget, setCustomizeTarget] = useState<ApiProduct | null>(null);

  const { data: categories = [] } = useCategoriesQuery();
  const effectiveCategoryId = search.trim() ? undefined : activeCategoryId;
  const { data: allProducts = [], isLoading: productsLoading } = useProductsQuery({
    categoryId: effectiveCategoryId,
  });
  const products = (search.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allProducts
  ).slice().sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller));

  const totalCount = Array.from(draft.values()).reduce((s, v) => s + v.quantity, 0);

  const setQty = (productId: string, qty: number) => {
    setDraft((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(productId);
      } else {
        const existing = prev.get(productId);
        next.set(productId, { ...(existing ?? { selectedOptions: {}, toppings: [] }), quantity: qty });
      }
      return next;
    });
  };

  const handleSave = async () => {
    const items: DraftItem[] = Array.from(draft.entries()).map(([productId, v]) => ({
      productId,
      ...v,
    }));
    await onSave(items);
  };

  useEffect(() => {
    if (!open) return;
    setDraft(() => {
      const m = new Map<string, DraftValue>();
      initialItems.forEach((item) =>
        m.set(item.productId, {
          quantity: item.quantity,
          selectedOptions: item.selectedOptions ?? {},
          toppings: item.toppings ?? [],
          note: item.note ?? undefined,
        }),
      );
      return m;
    });
    setCustomizeTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="relative flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:h-[88vh] sm:max-w-3xl sm:rounded-3xl lg:max-w-5xl xl:max-w-6xl"
          >
            <AnimatePresence>
              {customizeTarget && (
                <ProductCustomizeSheet
                  product={customizeTarget}
                  initial={draft.get(customizeTarget.id)}
                  onConfirm={(value) => {
                    setDraft((prev) => new Map(prev).set(customizeTarget.id, value));
                    setCustomizeTarget(null);
                  }}
                  onClose={() => setCustomizeTarget(null)}
                />
              )}
            </AnimatePresence>

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/6 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">{t("group_menu_eyebrow")}</p>
                <h2 className="text-base font-bold text-foreground">{t("group_select_items_title")}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full bg-black/6 text-foreground/60 hover:bg-black/10"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="shrink-0 px-5 pt-3">
              <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#f7f7f7] px-3 py-2">
                <Search className="size-4 shrink-0 text-foreground/40" />
                <input
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
                  placeholder={t("group_search_items")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-foreground/40 hover:text-foreground/70">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!search && (
              <div className="scrollbar-none shrink-0 flex gap-2 overflow-x-auto px-5 pb-1 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveCategoryId(undefined)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${!activeCategoryId
                    ? "bg-[#1a3c34] text-white"
                    : "bg-black/6 text-foreground/60 hover:bg-black/10"
                    }`}
                >
                  {t("group_all_categories")}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${activeCategoryId === cat.id
                      ? "bg-[#1a3c34] text-white"
                      : "bg-black/6 text-foreground/60 hover:bg-black/10"
                      }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {productsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-foreground/30" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-foreground/40">
                  {t("group_no_items_found")}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {products.map((product) => {
                    const draftVal = draft.get(product.id);
                    const qty = draftVal?.quantity ?? 0;
                    const price = product.finalPrice ?? parseFloat(product.price);
                    const originalPrice = product.discountPercent > 0 ? parseFloat(product.price) : null;
                    const thumb = product.imageUrls[0];
                    const unavailable = !product.isAvailable || product.isSoldOut;

                    return (
                      <div
                        key={product.id}
                        className={`flex flex-col rounded-2xl border bg-white transition ${qty > 0
                          ? "border-[#1a3c34]/30 shadow-[0_4px_16px_-6px_rgba(26,60,52,0.15)]"
                          : "border-black/6"
                          } ${unavailable ? "opacity-50" : ""}`}
                      >
                        <button
                          type="button"
                          disabled={unavailable}
                          onClick={() => !unavailable && setCustomizeTarget(product)}
                          className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-black/4"
                        >
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt={getDisplayName(product, locale)}
                              fill
                              className="object-cover"
                              sizes="(min-width: 640px) 200px, 160px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <ShoppingBag className="size-6 text-foreground/20" />
                            </div>
                          )}
                          {product.discountPercent > 0 && (
                            <span className="absolute left-2 top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              -{product.discountPercent}%
                            </span>
                          )}
                          {product.isBestSeller && !product.isSoldOut && (
                            <motion.span
                              className="flex gap-1 absolute top-2 right-2 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 shadow-[0_0_8px_1px_rgba(251,191,36,0.5)]"
                              initial={{ scale: 0.7, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
                            >
                              <motion.span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                animate={{ x: ["-120%", "220%"] }}
                                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", repeatDelay: 2.5 }}
                              />
                              <StarIcon className="size-3.5 text-amber-900" />
                              <span className="relative">{t("bestseller")}</span>
                            </motion.span>
                          )}
                          {/* {qty > 0 && (
                            <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[#1a3c34] text-[10px] font-bold text-white">
                              {qty}
                            </span>
                          )} */}
                        </button>

                        <div className="flex flex-1 flex-col justify-between gap-2 p-2.5">
                          <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                            {getDisplayName(product, locale)}
                          </p>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold tabular-nums text-[#26634d]">
                                {fmtVnd(price)}
                              </span>
                              {originalPrice && (
                                <span className="text-[10px] tabular-nums text-muted line-through">
                                  {fmtVnd(originalPrice)}
                                </span>
                              )}
                            </div>
                            {unavailable ? (
                              <span className="text-[10px] text-foreground/40">{t("group_sold_out")}</span>
                            ) : qty === 0 ? (
                              <button
                                type="button"
                                onClick={() => setCustomizeTarget(product)}
                                className="flex size-6 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-sm transition hover:opacity-90"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setQty(product.id, qty - 1)}
                                  className="flex size-6 items-center justify-center rounded-full border border-black/10 bg-white text-foreground/70 hover:bg-black/6"
                                >
                                  <Minus className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCustomizeTarget(product)}
                                  className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums text-foreground hover:text-[#1a3c34]"
                                >
                                  {qty}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQty(product.id, qty + 1)}
                                  className="flex size-6 items-center justify-center rounded-full bg-[#1a3c34] text-white shadow-sm transition hover:opacity-90"
                                >
                                  <Plus className="size-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-black/6 px-5 py-4">
              <Button
                className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-base font-semibold text-white disabled:bg-black/20 disabled:text-foreground/40"
                isDisabled={saving || totalCount === 0}
                onPress={() => void handleSave()}
              >
                {saving ? <Loader2 className="size-5 animate-spin" /> : <ShoppingBag className="size-5" />}
                {saving
                  ? t("group_saving_items")
                  : totalCount > 0
                    ? t("group_save_items_btn", { count: totalCount })
                    : t("group_pick_items")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── ParticipantRow ────────────────────────────────────────────────────────────

function ParticipantRow({
  participant,
  isMe,
  isMeHost,
  groupStatus,
  paymentMode,
  removingProductId,
  isKicking,
  onConfirmPaid,
  onKick,
  onOpenPicker,
  onRemoveItem,
}: {
  participant: GroupOrderState["participants"][0];
  isMe: boolean;
  isMeHost: boolean;
  groupStatus: GroupOrderState["status"];
  paymentMode: GroupOrderState["paymentMode"];
  removingProductId?: string | null;
  isKicking?: boolean;
  onConfirmPaid?: (participantId: string) => void;
  onKick?: (participantId: string) => void;
  onOpenPicker?: () => void;
  onRemoveItem?: (productId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations();
  // cash is auto-confirmed (collected by shipper); bank_transfer is auto-confirmed via webhook
  const canConfirm =
    groupStatus === "locked" &&
    paymentMode === "split" &&
    participant.paymentStatus === "pending" &&
    participant.items.length > 0 &&
    participant.paymentType !== null &&
    participant.paymentType !== "cash" &&
    participant.paymentType !== "bank_transfer" &&
    (isMe || isMeHost);

  return (
    <div className="transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {participant.avatar ? (
            <Image
              src={participant.avatar}
              alt={participant.name}
              width={32}
              height={32}
              className="size-8 rounded-full object-cover ring-1 ring-black/6"
            />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-full bg-black/8 text-xs font-bold text-foreground/60">
              {participant.name[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {participant.name}
              {participant.isHost && (
                <Crown className="ml-1.5 inline-block size-3.5 text-amber-500" />
              )}
              {isMe && (
                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-[#1a3c34]">
                  {t("group_you")}
                </span>
              )}
            </p>
            <p className="text-xs text-foreground/50">
              {participant.items.length} món ·{" "}
              <span className="text-sm font-bold tabular-nums text-[#1a3c34]">{fmtVnd(participant.subtotal)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMeHost && !participant.isHost && !isMe && groupStatus === "collecting" && (
            <button
              type="button"
              disabled={isKicking}
              onClick={() => onKick?.(participant.id)}
              className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
            >
              {isKicking ? <Loader2 className="size-3 animate-spin" /> : <UserX className="size-3" />}
              {isKicking ? t("group_kicking") : t("group_kick_btn")}
            </button>
          )}
          {isMe && groupStatus === "collecting" && (
            <button
              type="button"
              onClick={onOpenPicker}
              className="flex items-center gap-1 rounded-full bg-[#1a3c34] px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90"
            >
              {participant.items.length > 0
                ? <><Pencil className="size-3" />{t('edit_dish')}</>
                : <><Plus className="size-3" />{t('choose_dish')}</>
              }
            </button>
          )}
          {participant.isReady && groupStatus === "collecting" && (
            <CheckCircle2 className="size-4 text-emerald-500" />
          )}
          {paymentMode === "split" && groupStatus === "locked" && (
            participant.paymentStatus === "paid" ? (
              participant.paymentType === "cash" ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  <Banknote className="size-3" /> {t("cash")}
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                  <Check className="size-3" /> {t("group_paid")}
                </span>
              )
            ) : participant.paymentType === "bank_transfer" && participant.items.length > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                <Loader2 className="size-3 animate-spin" /> {t("group_awaiting_transfer")}
              </span>
            ) : participant.items.length > 0 && canConfirm ? (
              <Button
                size="sm"
                className="rounded-full bg-[#1a3c34] px-3 py-1 text-xs font-semibold text-white"
                onPress={() => onConfirmPaid?.(participant.id)}
              >
                {t("group_confirm_paid")}
              </Button>
            ) : null
          )}
        </div>
      </div>

      {participant.items.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-black/6 pt-3">
          {participant.items.map((item) => {
            const imageUrl = item.product?.imageUrls[0] ?? null;
            const displayName = item.product ? getDisplayName(item.product, locale) : "Sản phẩm";
            const groups = normalizeOptionGroups(item.product?.optionGroups);
            const resolvedOptions = Object.entries(item.selectedOptions ?? {})
              .map(([groupName, optionLabel]) => {
                const grp = groups.find((g) => g.name === groupName);
                const val = grp?.values.find((v) => v.label === optionLabel);
                return {
                  groupName: grp ? getDisplayName(grp, locale) : groupName,
                  label: val?.nameTranslation?.[locale] ?? val?.label ?? optionLabel,
                  priceDelta: val?.priceDelta ?? 0,
                };
              })
              .filter((o) => o.label);
            const toppingTotal = item.toppings?.reduce((s, t) => s + t.price, 0) ?? 0;
            const lineTotal = (item.unitPrice + toppingTotal) * item.quantity;
            const canRemove = isMe && groupStatus === "collecting" && !participant.isReady;
            const isRemoving = removingProductId === item.productId;

            return (
              <div key={item.id} className="flex items-start gap-3">
                {/* Thumbnail + qty badge */}
                <div className="relative size-14 shrink-0">
                  <div
                    className="absolute inset-0 overflow-hidden rounded-xl ring-1 ring-black/6"
                    style={{ backgroundColor: imageUrl ? undefined : "#1a3c34" }}
                  >
                    {imageUrl ? (
                      <Image src={imageUrl} alt={displayName} fill className="object-cover" sizes="56px" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="select-none text-lg font-black text-white/20">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-1.5 -right-1.5 flex size-[18px] items-center justify-center rounded-full bg-[#1a3c34] text-[9px] font-bold text-white ring-2 ring-white">
                    {item.quantity}
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {displayName}
                    </p>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-[#1a3c34]">
                      {fmtVnd(lineTotal)}
                    </p>
                  </div>

                  {(resolvedOptions.length > 0 || (item.toppings && item.toppings.length > 0) || item.note) && (
                    <div className="mt-1.5 space-y-1.5">
                      {(resolvedOptions.length > 0 || (item.toppings && item.toppings.length > 0)) && (
                        <div className="flex flex-col items-start gap-1">
                          {resolvedOptions.map((o, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full bg-surface-card px-2.5 py-0.5 text-[11px] font-medium text-foreground/70"
                            >
                              {formatOptionLabel(o.groupName, o.label, locale)}
                              {o.priceDelta > 0 && (
                                <span className="text-[10px] text-muted">+{fmtVnd(o.priceDelta)}</span>
                              )}
                            </span>
                          ))}
                          {item.toppings?.map((top) => (
                            <span
                              key={top.toppingId}
                              className="inline-flex items-center gap-1 rounded-full bg-kun-mint/20 px-2.5 py-0.5 text-[11px] font-medium text-kun-products-forest"
                            >
                              + {top.nameTranslation?.[locale] ?? top.name}
                              {top.price > 0 && (
                                <span className="text-[10px] text-kun-products-forest/60">+{fmtVnd(top.price)}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <p className="flex items-center gap-1 text-[11px] text-muted italic">
                          <StickyNote className="size-3 shrink-0 text-muted/70" />
                          {item.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => !isRemoving && onRemoveItem?.(item.productId)}
                    disabled={!!removingProductId}
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none ${isRemoving
                      ? "bg-red-50 text-red-400"
                      : "bg-black/6 text-foreground/35 hover:bg-red-50 hover:text-red-500"
                      }`}
                  >
                    {isRemoving
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Trash2 className="size-3.5" />
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DiscountBanner ────────────────────────────────────────────────────────────

function DiscountBanner({
  participantCount,
  tiers,
}: {
  participantCount: number;
  tiers: GroupDiscountTier[];
}) {
  const t = useTranslations();
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
  const current = resolveDiscount(participantCount, tiers);
  const next = sorted.find((tier) => tier.minParticipants > participantCount);

  return (
    <div className="rounded-2xl border border-dashed border-[#1a3c34]/30 bg-gradient-to-br from-[#f0faf6] to-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[#1a3c34]" />
          <span className="text-sm font-semibold text-[#1a3c34]">{t("group_discount_title")}</span>
        </div>
        {current > 0 ? (
          <span className="rounded-full bg-[#1a3c34] px-3 py-0.5 text-xs font-bold text-white">
            {t("group_discount_active", { pct: current })}
          </span>
        ) : next ? (
          <span className="text-xs text-foreground/60">
            {t("group_add_for_tier", { need: next.minParticipants - participantCount, pct: next.discountPercent })}
          </span>
        ) : null}
      </div>
      {tiers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {sorted.map((tier) => (
            <div
              key={tier.minParticipants}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${participantCount >= tier.minParticipants
                ? "bg-[#1a3c34] text-white ring-[#1a3c34]"
                : "bg-white text-foreground/50 ring-black/10"
                }`}
            >
              {tier.minParticipants}+ {t("group_people")}: -{tier.discountPercent}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ShareLinkBox ──────────────────────────────────────────────────────────────

function ShareLinkBox({ token: _token }: { token: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Đặt đơn nhóm cùng mình tại UjCha",
          text: "Mình đang đặt đồ nhóm tại UjCha, bạn tham gia cùng nhé! Càng nhiều người giảm giá càng sâu.",
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      await copy();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        className="gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/4"
        onPress={copy}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span key="check" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.14 }}>
              <Check className="size-3.5 text-emerald-500" />
            </motion.span>
          ) : (
            <motion.span key="copy" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.14 }}>
              <Copy className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
        {copied ? t("group_copied") : t("group_copy_link")}
      </Button>
      <Button
        size="sm"
        className="gap-1.5 rounded-full bg-kun-primary/10 px-3 py-1 text-xs font-semibold text-kun-primary hover:bg-kun-primary/15"
        onPress={() => void handleShare()}
      >
        <Share2 className="size-3.5" />
        {t("share")}
      </Button>
    </div>
  );
}

type ShareBreakdown = {
  subtotal: number;
  discountPct: number;
  discountAmt: number;
  shippingShare: number;
  isHostPaysShipping: boolean;
  isHost: boolean;
  total: number;
};

function ShareBreakdownPopup({ bd }: { bd: ShareBreakdown }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 80);
  }, []);

  const openPopup = useCallback(() => {
    cancelClose();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      bottom: `${window.innerHeight - rect.top + 8}px`,
      left: `${rect.left + rect.width / 2}px`,
      transform: "translateX(-50%)",
      zIndex: 9999,
    });
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={openPopup}
        onMouseLeave={scheduleClose}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openPopup(); }}
        className="flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-[#1a3c34]/10"
      >
        <Info className="size-3 text-[#1a3c34]/40" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <span
          style={style}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="w-52 space-y-1.5 rounded-xl border border-black/8 bg-white p-3 text-[11px] font-normal text-foreground shadow-xl"
        >
          <span className="flex justify-between">
            <span className="text-foreground/55">{t("group_split_items")}</span>
            <span className="tabular-nums">{fmtVnd(bd.subtotal)}</span>
          </span>
          {bd.discountAmt > 0 && (
            <span className="flex justify-between">
              <span className="text-foreground/55">{t("group_split_discount_pct", { pct: bd.discountPct })}</span>
              <span className="tabular-nums text-emerald-600">-{fmtVnd(bd.discountAmt)}</span>
            </span>
          )}
          {bd.isHostPaysShipping ? (
            bd.isHost ? (
              <span className="flex justify-between">
                <span className="text-foreground/55">{t("group_split_shipping_all")}</span>
                <span className="tabular-nums">+{fmtVnd(bd.shippingShare)}</span>
              </span>
            ) : (
              <span className="flex justify-between">
                <span className="text-foreground/55">{t("group_split_shipping")}</span>
                <span className="text-emerald-600">{t("group_split_shipping_host_free")}</span>
              </span>
            )
          ) : bd.shippingShare > 0 ? (
            <span className="flex justify-between">
              <span className="text-foreground/55">{t("group_split_shipping")}</span>
              <span className="tabular-nums">+{fmtVnd(bd.shippingShare)}</span>
            </span>
          ) : null}
        </span>,
        document.body,
      )}
    </span>
  );
}

// ── GroupOrderPageShell ───────────────────────────────────────────────────────

export function GroupOrderPageShell() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const { data: savedAddresses = [] } = useAddressesQuery();
  const { data: profile } = useProfileQuery();
  const { data: storeLocation } = usePublicStoreLocationQuery();

  const [state, setState] = useState<GroupOrderState | null>(null);
  const [config, setConfig] = useState<GroupDiscountTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const myParticipantIdRef = useRef<string | null>(null);
  const prevParticipantIdsRef = useRef<Set<string>>(new Set());
  const [isKicked, setIsKicked] = useState(false);
  const [isDissolved, setIsDissolved] = useState(false);
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [joinNotif, setJoinNotif] = useState<string | null>(null);
  const [leaveNotif, setLeaveNotif] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  useEffect(() => { myParticipantIdRef.current = myParticipantId; }, [myParticipantId]);
  useEffect(() => {
    if (!joinNotif) return;
    const id = setTimeout(() => setJoinNotif(null), 3000);
    return () => clearTimeout(id);
  }, [joinNotif]);
  useEffect(() => {
    if (!leaveNotif) return;
    const id = setTimeout(() => setLeaveNotif(null), 3000);
    return () => clearTimeout(id);
  }, [leaveNotif]);
  const [needsGuestName, setNeedsGuestName] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [duplicateTab, setDuplicateTab] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);

  // Derived from server state — not localStorage — so all participants see the same value
  const shippingFeeMode = state?.shippingFeeMode ?? "split";

  // ── Inline fulfillment form state (host only, collecting) ─────────────────
  const [localType, setLocalType] = useState<"delivery" | "pickup">("delivery");
  const [localSelectedAddressId, setLocalSelectedAddressId] = useState<string | null>(null);
  const [localDeliveryForm, setLocalDeliveryForm] = useState<DeliveryForm>({
    fullAddress: "", name: "", phone: "", note: "", lat: null, lng: null,
  });
  const [localPickupForm, setLocalPickupForm] = useState<PickupForm>({
    mode: "asap", scheduledTime: "", name: "", phone: "",
  });
  const splitCashConfirmRef = useRef(false);
  const autoSavePendingRef = useRef(false);

  const socketRef = useRef<Socket | null>(null);

  const me = state?.participants.find(
    (p) => (myParticipantId && p.id === myParticipantId) || (user?.id && p.userId === user.id),
  );
  const isHost = me?.isHost ?? false;

  const matchedAddress = savedAddresses.find((a) => a.id === state?.address?.id);
  const addrLat = matchedAddress?.lat && matchedAddress.lat !== 0 ? matchedAddress.lat : null;
  const addrLng = matchedAddress?.lng && matchedAddress.lng !== 0 ? matchedAddress.lng : null;
  const { data: shippingEstimate } = useShippingEstimateQuery(addrLat, addrLng, 0);
  const { data: payConfig } = usePublicPaymentConfigQuery();
  const { data: shippingConfig } = usePublicShippingConfigQuery();

  const load = useCallback(async () => {
    try {
      const [go, cfg] = await Promise.all([
        fetchGroupOrder(token),
        fetchGroupOrderConfig().catch(() => ({ id: "default", isEnabled: true, discountTiers: [] })),
      ]);
      setState(go);
      prevParticipantIdsRef.current = new Set(go.participants.map((p) => p.id));
      setConfig(cfg.discountTiers);
      localStorage.setItem(
        `group_order_meta_${token}`,
        JSON.stringify({ token: go.token, expiresAt: go.expiresAt, type: go.type, status: go.status }),
      );
      // Participants who refresh after dissolution see status=cancelled but miss the socket event
      if (go.status === "cancelled") {
        const hadSession = !!localStorage.getItem(SESSION_KEY(token));
        if (hadSession) {
          clearGroupOrderSession(token);
          setIsDissolved(true);
          setTimeout(() => router.push(ROUTES.HOME), 2500);
        }
      }
    } catch {
      setError("Không tìm thấy đơn nhóm này.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // BroadcastChannel: respond to duplicate-tab probe once we have a session
  useEffect(() => {
    if (!sessionToken || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(GROUP_ORDER_BC);
    const handler = (e: MessageEvent<{ type: string; token: string }>) => {
      if (e.data.type === "CHECK_TOKEN" && e.data.token === token) {
        bc.postMessage({ type: "ALREADY_HERE", token });
      }
    };
    bc.addEventListener("message", handler);
    return () => {
      bc.removeEventListener("message", handler);
      bc.close();
    };
  }, [sessionToken, token]);

  useEffect(() => {
    if (!state) return;
    const storedSession = localStorage.getItem(SESSION_KEY(token));
    const storedParticipant = localStorage.getItem(PARTICIPANT_KEY(token));
    if (storedSession) {
      // Verify the stored participant still exists — if not, they were kicked.
      // Clear the stale session so they go through the join flow again.
      const wasKicked = storedParticipant && !state.participants.some((p) => p.id === storedParticipant);
      if (wasKicked) {
        localStorage.removeItem(SESSION_KEY(token));
        localStorage.removeItem(PARTICIPANT_KEY(token));
        if (state.status === "collecting") {
          if (user) {
            void handleJoin();
          } else {
            setNeedsGuestName(true);
          }
        }
        return;
      }
      setSessionToken(storedSession);
      if (storedParticipant) setMyParticipantId(storedParticipant);
      // Sync deviceId for logged-in users so incognito bypass is blocked.
      // alreadyJoined path: no broadcast, just a DB update if deviceId was null.
      if (user) {
        getDeviceId().then((deviceId) => joinGroupOrder(token, { deviceId }).catch(() => { }));
      }
      return;
    }
    if (user) {
      const existing = state.participants.find((p) => p.userId === user.id);
      if (existing) {
        setMyParticipantId(existing.id);
        localStorage.setItem(PARTICIPANT_KEY(token), existing.id);
        getDeviceId().then((deviceId) => joinGroupOrder(token, { deviceId }).catch(() => { }));
        return;
      }
    }
    if (state.status === "collecting") {
      if (user) {
        void handleJoin();
      } else {
        // Guest: ask for display name before joining
        setNeedsGuestName(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.id, user?.id]);

  const handleJoin = useCallback(async (guestName?: string) => {
    // Layer 1: localStorage lock — guards concurrent same-browser joins before BC listener is active
    const lockTs = localStorage.getItem(JOIN_LOCK_KEY(token));
    if (lockTs && Date.now() - parseInt(lockTs) < JOIN_LOCK_TTL) {
      setDuplicateTab(true);
      return;
    }
    localStorage.setItem(JOIN_LOCK_KEY(token), Date.now().toString());

    // Layer 2: BroadcastChannel — detect already-joined tab
    const isDuplicate = await detectDuplicateTab(token);
    if (isDuplicate) {
      localStorage.removeItem(JOIN_LOCK_KEY(token));
      setDuplicateTab(true);
      return;
    }

    setJoining(true);
    try {
      const deviceId = await getDeviceId();
      const res = await joinGroupOrder(token, {
        deviceId,
        guestName: guestName?.trim() || undefined,
      });
      setSessionToken(res.sessionToken);
      setMyParticipantId(res.participantId);
      localStorage.setItem(SESSION_KEY(token), res.sessionToken);
      localStorage.setItem(PARTICIPANT_KEY(token), res.participantId);
      localStorage.removeItem(JOIN_LOCK_KEY(token));
      setNeedsGuestName(false);
      const go = await fetchGroupOrder(token);
      setState(go);
    } catch (err: unknown) {
      localStorage.removeItem(JOIN_LOCK_KEY(token));
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "GROUP_ORDER_DEVICE_ALREADY_JOINED") {
        setDuplicateTab(true);
      } else {
        setError(t((code as Parameters<typeof t>[0]) ?? "GROUP_ORDER_NOT_FOUND"));
      }
    } finally {
      setJoining(false);
    }
  }, [token, t]);

  useEffect(() => {
    const socket = io(`${env.API_URL}/group`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;
    socket.emit("join-room", { token });
    socket.on("member-left", (data: { name: string }) => {
      setLeaveNotif(data.name);
    });
    socket.on("updated", (newState: GroupOrderState) => {
      const prevIds = prevParticipantIdsRef.current;
      const pid = myParticipantIdRef.current;
      const newOthers = newState.participants.filter((p) => !prevIds.has(p.id) && p.id !== pid);
      if (newOthers.length > 0) setJoinNotif(newOthers[0].name);
      prevParticipantIdsRef.current = new Set(newState.participants.map((p) => p.id));
      setState(newState);
      if (pid && !newState.participants.some((p) => p.id === pid)) {
        localStorage.removeItem(SESSION_KEY(token));
        localStorage.removeItem(PARTICIPANT_KEY(token));
        setIsKicked(true);
      }
      // Keep nav meta in sync — UserProfile reads this to show active sessions
      localStorage.setItem(
        `group_order_meta_${token}`,
        JSON.stringify({ token: newState.token, expiresAt: newState.expiresAt, type: newState.type, status: newState.status }),
      );
    });
    socket.on("kicked", (data: { participantId: string }) => {
      if (myParticipantIdRef.current && data.participantId === myParticipantIdRef.current) {
        localStorage.removeItem(SESSION_KEY(token));
        localStorage.removeItem(PARTICIPANT_KEY(token));
        setIsKicked(true);
      }
    });
    socket.on("dissolved", () => {
      clearGroupOrderSession(token);
      setIsDissolved(true);
      setTimeout(() => router.push(ROUTES.HOME), 2500);
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);


  // Redirect to order detail as soon as an order is created (bank_transfer → on lock; cash → after checkout)
  useEffect(() => {
    if (state?.order?.paymentCode) {
      router.push(ROUTES.ORDER_DETAIL(state.order.paymentCode));
    }
  }, [state?.order?.paymentCode, router]);

  // Auto-confirm cash split participants — cash is collected by shipper on delivery, no manual confirmation needed
  useEffect(() => {
    if (
      state?.status === "locked" &&
      state.paymentMode === "split" &&
      me?.paymentStatus === "pending" &&
      me.paymentType === "cash" &&
      me.items.length > 0 &&
      sessionToken &&
      !splitCashConfirmRef.current
    ) {
      splitCashConfirmRef.current = true;
      void confirmParticipantPaid(token, sessionToken, me.id)
        .then((newState) => setState(newState))
        .catch(() => { splitCashConfirmRef.current = false; });
    }
  }, [state?.status, state?.paymentMode, me?.paymentStatus, me?.paymentType, me?.items.length, me?.id, sessionToken, token]);

  const withAction = async (fn: () => Promise<GroupOrderState | { groupOrder: GroupOrderState }>) => {
    if (!sessionToken) return;
    setActionLoading(true);
    try {
      const res = await fn();
      const go = "groupOrder" in res ? res.groupOrder : res;
      setState(go);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDissolve = async () => {
    if (!sessionToken) return;
    setActionLoading(true);
    try {
      await dissolveGroupOrder(token, sessionToken);
      clearGroupOrderSession(token);
      router.push(ROUTES.HOME);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
      setShowDissolveConfirm(false);
    } finally {
      setActionLoading(false);
    }
  };

  // Sync local form from server state (when group order first loads or changes)
  useEffect(() => {
    if (!state) return;
    setLocalType((state.type === "table" ? "pickup" : state.type) as "delivery" | "pickup");
    setLocalSelectedAddressId(state.address?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.id]);

  // Auto-select default address for delivery
  useEffect(() => {
    if (localType !== "delivery" || localSelectedAddressId !== null) return;
    const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (def) setLocalSelectedAddressId(def.id);
  }, [localType, savedAddresses, localSelectedAddressId]);

  // Sync profile into form fields (once)
  useEffect(() => {
    if (!profile) return;
    setLocalDeliveryForm((p) => ({
      ...p,
      name: p.name || profile.name || "",
      phone: p.phone || profile.phone || "",
    }));
    setLocalPickupForm((p) => ({
      ...p,
      name: p.name || profile.name || "",
      phone: p.phone || profile.phone || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Hooks must be before any early returns ─────────────────────────────────

  // Inline shipping estimate for the fulfillment form
  const localShowNewForm = localSelectedAddressId === "__new__" || savedAddresses.length === 0;
  const localTotalAmount = (state?.participants ?? []).reduce((s, p) => s + p.subtotal, 0);

  const localShippingLat = useMemo(() => {
    if (localType !== "delivery") return null;
    if (localShowNewForm) return localDeliveryForm.lat;
    const addr = savedAddresses.find((a) => a.id === localSelectedAddressId);
    return addr?.lat && addr.lat !== 0 ? addr.lat : null;
  }, [localType, localShowNewForm, localDeliveryForm.lat, savedAddresses, localSelectedAddressId]);

  const localShippingLng = useMemo(() => {
    if (localType !== "delivery") return null;
    if (localShowNewForm) return localDeliveryForm.lng;
    const addr = savedAddresses.find((a) => a.id === localSelectedAddressId);
    return addr?.lng && addr.lng !== 0 ? addr.lng : null;
  }, [localType, localShowNewForm, localDeliveryForm.lng, savedAddresses, localSelectedAddressId]);

  const { data: localShippingEstimate, isFetching: localShippingFetching } =
    useShippingEstimateQuery(localShippingLat, localShippingLng, localTotalAmount);

  const localShippingFee = localType === "delivery" ? (localShippingEstimate?.fee ?? 0) : 0;
  const localShippingIsFree = localType === "delivery" && (localShippingEstimate?.isFree ?? false);
  const localShippingIsOutOfRange = localType === "delivery" && (localShippingEstimate?.isOutOfRange ?? false);

  // Mark auto-save pending whenever the user changes type, address, or payment
  useEffect(() => {
    autoSavePendingRef.current = true;
  }, [localType, localSelectedAddressId]);

  // Trigger auto-save once shipping estimate settles (or immediately for pickup)
  useEffect(() => {
    if (!autoSavePendingRef.current || !isHost || state?.status !== "collecting" || !sessionToken) return;
    if (localType === "delivery") {
      if (localShippingFetching || localShippingIsOutOfRange) return;
      if (!localShowNewForm && !localSelectedAddressId) return;
      if (localShowNewForm && !localDeliveryForm.lat) return;
    }
    autoSavePendingRef.current = false;
    void (async () => {
      try {
        let addressId: string | undefined;
        if (localType === "delivery") {
          if (localShowNewForm) {
            const created = await createAddress({
              fullAddress: localDeliveryForm.fullAddress.trim(),
              lat: localDeliveryForm.lat ?? 0,
              lng: localDeliveryForm.lng ?? 0,
            });
            addressId = created.id;
          } else {
            addressId = localSelectedAddressId ?? undefined;
          }
        }
        const pickupTime = localType === "pickup"
          ? new Date(Date.now() + 20 * 60_000).toISOString()
          : undefined;
        const newState = await setGroupOrderFulfillment(token, sessionToken, {
          type: localType,
          addressId,
          shippingFee: localType === "delivery" ? localShippingFee : 0,
          pickupTime,
          shippingFeeMode: state?.shippingFeeMode,
        });
        setState(newState);
      } catch {
        // Silent fail — user can retry via the lock action
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localShippingFetching, localShippingFee]);

  // Per-participant amount for split mode (discount proportional, shipping per shippingFeeMode)
  const myAmountBreakdown = useMemo(() => {
    if (!state || !me || state.paymentMode !== "split" || me.items.length === 0) return null;
    const activeCount = state.participants.filter((p) => p.items.length > 0).length;
    const discountPct = resolveDiscount(activeCount, config);
    const discountAmt = Math.round(me.subtotal * discountPct / 100);
    const shippingShare = Math.round(shippingFeeMode === "host_pays"
      ? (isHost ? state.shippingFee : 0)
      : (activeCount > 0 ? state.shippingFee / activeCount : 0));
    return {
      subtotal: me.subtotal,
      discountPct,
      discountAmt,
      shippingShare,
      isHostPaysShipping: shippingFeeMode === "host_pays",
      isHost,
      total: Math.round(me.subtotal - discountAmt + shippingShare),
    };
  }, [state, me, config, shippingFeeMode, isHost]);
  const myAmount = myAmountBreakdown?.total ?? 0;

  const handleHostCheckout = useCallback(async () => {
    if (!sessionToken || !state) return;
    const paymentType = state.paymentType ?? "cash";
    setActionLoading(true);
    try {
      if (state.status === "collecting") {
        await lockGroupOrder(token, sessionToken);
      }
      const res = await checkoutHostPays(token, sessionToken, paymentType);
      const go = res.groupOrder;
      setState(go);
      if (go.order?.paymentCode) {
        router.push(ROUTES.ORDER_DETAIL(go.order.paymentCode));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setActionLoading(false);
    }
  }, [sessionToken, state, token, router]);

  const handleSplitCashCheckout = useCallback(async () => {
    if (!sessionToken || !state) return;
    setActionLoading(true);
    try {
      const res = await checkoutSplitCash(token, sessionToken);
      const go = res.groupOrder;
      setState(go);
      if (go.order?.paymentCode) {
        router.push(ROUTES.ORDER_DETAIL(go.order.paymentCode));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setActionLoading(false);
    }
  }, [sessionToken, state, token, router]);

  const handleSaveItems = async (items: DraftItem[]) => {
    if (!sessionToken) return;
    setPickerSaving(true);
    try {
      const newState = await updateGroupOrderItems(token, sessionToken, items);
      setState(newState);
      setShowPicker(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setPickerSaving(false);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    if (!sessionToken || !me) return;
    setRemovingProductId(productId);
    try {
      const remaining = me.items
        .filter((item) => item.productId !== productId)
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
          toppings: item.toppings,
          note: item.note ?? undefined,
        }));
      const newState = await updateGroupOrderItems(token, sessionToken, remaining);
      setState(newState);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setRemovingProductId(null);
    }
  };

  const handleLeave = useCallback(async () => {
    if (!sessionToken) return;
    setIsLeaving(true);
    try {
      await leaveGroupOrder(token, sessionToken);
      localStorage.removeItem(SESSION_KEY(token));
      localStorage.removeItem(PARTICIPANT_KEY(token));
      clearGroupOrderSession(token);
      router.push(ROUTES.HOME);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      toast.error(typeof msg === "string" ? msg : msg.join(", "));
      setIsLeaving(false);
    }
  }, [sessionToken, token, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-foreground">{error ?? "Đơn nhóm không tồn tại."}</p>
        </div>
      </div>
    );
  }

  if (duplicateTab) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm space-y-4 rounded-3xl border border-red-100 bg-white p-8 text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50">
            <UserX className="size-6 text-red-500" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">{t("group_order_duplicate_tab")}</p>
            <p className="text-sm text-foreground/55">{t("group_order_duplicate_tab_desc")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (needsGuestName && !sessionToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-black/6 bg-white p-8 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.10)]">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("group_order_session_title")}</p>
            <h2 className="mt-1 text-lg font-bold text-foreground">{t("group_order_guest_name_label")}</h2>
            <p className="mt-1 text-sm text-muted">{t("group_order_guest_name_desc")}</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (guestNameInput.trim()) void handleJoin(guestNameInput); }}
            className="space-y-3"
          >
            <input
              type="text"
              autoFocus
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              placeholder={t("group_order_guest_name_placeholder")}
              maxLength={60}
              className="w-full rounded-2xl border border-black/10 bg-surface-soft px-4 py-3 text-sm outline-none focus:border-[#1a3c34] focus:ring-2 focus:ring-[#1a3c34]/20"
            />
            <button
              type="submit"
              disabled={joining || !guestNameInput.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {joining ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
              {joining ? t("group_joining") : t("group_order_join_as_guest")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#1a3c34]" />
      </div>
    );
  }

  const totalItems = state.participants.reduce((s, p) => s + p.items.length, 0);
  const totalAmount = state.participants.reduce((s, p) => s + p.subtotal, 0);
  const activeParticipants = state.participants.filter((p) => p.items.length > 0);
  const discountPercent = resolveDiscount(activeParticipants.length, config);
  const discountAmount = Math.round((totalAmount * discountPercent) / 100);
  const finalAmount = totalAmount - discountAmount + state.shippingFee;

  const allReady =
    state.participants.length > 1 && state.participants.every((p) => p.isReady);

  const FulfillmentIcon =
    state.type === "delivery" ? Truck : state.type === "table" ? Utensils : ShoppingBag;
  const needsAddress = state.type === "delivery" && !state.address;
  const fulfillmentLabel = t(
    state.type === "delivery" ? "type_delivery" :
      state.type === "table" ? "type_table" : "type_pickup"
  );

  return (
    <>
      {/* New participant join / leave toasts */}
      <AnimatePresence>
        {joinNotif && (
          <motion.div
            key="join-notif"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 380 }}
            className="fixed left-1/2 top-5 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2.5 rounded-full bg-[#1a3c34] px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
              <Users className="size-4 shrink-0" />
              <span>{t("group_joined_notif", { name: joinNotif })}</span>
            </div>
          </motion.div>
        )}
        {leaveNotif && (
          <motion.div
            key="leave-notif"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 380 }}
            className="fixed left-1/2 top-5 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-2.5 rounded-full bg-foreground/80 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
              <LogOut className="size-4 shrink-0" />
              <span>{t("group_left_notif", { name: leaveNotif })}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPicker && me && (
        <ProductPickerDrawer
          open={showPicker}
          onClose={() => setShowPicker(false)}
          initialItems={me.items}
          onSave={handleSaveItems}
          saving={pickerSaving}
        />
      )}

      <div className="container mx-auto max-w-[72rem] px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
              {t("group_order_badge")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("group_headline")}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={state.status} />
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${state.paymentMode === "host_pays"
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-[#f0faf6] text-[#1a3c34] ring-[#1a3c34]/20"
                  }`}
              >
                {state.paymentMode === "host_pays" ? (
                  <Crown className="size-3" />
                ) : (
                  <Users className="size-3" />
                )}
                {state.paymentMode === "host_pays" ? t("group_host_pays") : t("group_split_pay")}
              </span>
              <span className="text-xs text-foreground/50">
                <Users className="mr-1 inline-block size-3.5" />
                {t("group_n_members", { count: state.participants.length })}
              </span>
              <span className="text-xs text-foreground/40">
                <Clock className="mr-1 inline-block size-3.5" />
                {t("group_expires", { time: new Date(state.expiresAt).toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" }) })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ShareLinkBox token={token} />

            {state.status === "collecting" && isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 font-semibold text-red-600 hover:bg-red-100"
                isDisabled={actionLoading}
                onPress={() => setShowDissolveConfirm(true)}
              >
                <UserX className="size-3.5" />
                {t("group_dissolve_btn")}
              </Button>
            )}

            {state.status === "collecting" && me && !isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 font-semibold text-red-600 hover:bg-red-100"
                isDisabled={isLeaving}
                onPress={() => void handleLeave()}
              >
                {isLeaving ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                {isLeaving ? t("group_leaving") : t("group_leave_btn")}
              </Button>
            )}

            {state.status === "collecting" && isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full bg-[#1a3c34] px-4 font-semibold text-white disabled:opacity-60"
                isDisabled={actionLoading}
                onPress={() => {
                  const unconfirmed = state.participants.filter((p) => !p.isReady);
                  if (unconfirmed.length > 0) {
                    setShowLockConfirm(true);
                  } else if (state.paymentMode === "split" && (state.paymentType ?? "cash") === "cash") {
                    void handleSplitCashCheckout();
                  } else if (state.paymentMode === "host_pays" && (state.paymentType ?? "cash") !== "bank_transfer") {
                    void handleHostCheckout();
                  } else {
                    void withAction(() => lockGroupOrder(token, sessionToken!));
                  }
                }}
              >
                <Check className="size-3.5" />
                {t("group_lock")}
                {!allReady && (
                  <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums leading-none">
                    {state.participants.filter((p) => p.isReady).length}/{state.participants.length}
                  </span>
                )}
              </Button>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {/* Left — participants + actions */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Discount banner */}
            {config.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <DiscountBanner participantCount={activeParticipants.length} tiers={config} />
              </motion.div>
            )}

            {/* My actions — pick / ready */}
            {me && state.status === "collecting" && !me.isReady && (
              <div className="flex gap-1">
                <Button
                  className="flex-1 rounded-full border border-[#1a3c34]/30 bg-white py-3 font-semibold text-[#1a3c34] hover:bg-[#f0faf6]"
                  onPress={() => setShowPicker(true)}
                >
                  <Plus className="mr-1 size-4" />
                  {me.items.length > 0
                    ? t("group_edit_items", { count: me.items.reduce((s, i) => s + i.quantity, 0) })
                    : t("group_pick_items")}
                </Button>
                <Button
                  className="flex-1 rounded-full bg-[#1a3c34] py-3 font-semibold text-white"
                  isDisabled={actionLoading || me.items.length === 0}
                  onPress={() =>
                    void withAction(() => markGroupOrderReady(token, sessionToken!))
                  }
                >
                  <CheckCircle2 className="mr-1 size-4" />
                  {t("group_confirm_ready")}
                </Button>
              </div>
            )}

            {me && me.isReady && state.status === "collecting" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <CheckCircle2 className="mx-auto mb-1 size-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">{t("group_ready_title")}</p>
                <p className="mt-0.5 text-xs text-emerald-700">{t("group_ready_waiting")}</p>
              </div>
            )}

            {/* Participants */}
            <div className="overflow-hidden rounded-3xl border border-black/6 bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-black/6 px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("group_participants_card_eyebrow")}</p>
                  <p className="text-sm font-semibold text-foreground">{t("group_participants_card_title")}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-card px-2.5 py-1 text-xs font-semibold text-foreground/60">
                  <Users className="size-3" />
                  {state.participants.length}
                </span>
              </div>
              <div className="divide-y divide-black/6">
                  {[...state.participants].sort((a, b) => {
                    const rankA = a.id === me?.id ? 0 : a.isHost ? 1 : 2;
                    const rankB = b.id === me?.id ? 0 : b.isHost ? 1 : 2;
                    return rankA - rankB;
                  }).map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.07 + i * 0.04 }}
                      className={`p-4 transition-colors ${p.id === me?.id ? "bg-[#f0faf6]" : ""}`}
                    >
                      <ParticipantRow
                        participant={p}
                        isMe={p.id === me?.id}
                        isMeHost={isHost}
                        groupStatus={state.status}
                        paymentMode={state.paymentMode}
                        onConfirmPaid={(participantId) =>
                          void withAction(() => confirmParticipantPaid(token, sessionToken!, participantId))
                        }
                        isKicking={kickingId === p.id}
                        onKick={async (participantId) => {
                          setKickingId(participantId);
                          await withAction(() => kickGroupOrderParticipant(token, sessionToken!, participantId));
                          setKickingId(null);
                        }}
                        removingProductId={removingProductId}
                        onOpenPicker={() => setShowPicker(true)}
                        onRemoveItem={(productId) => void handleRemoveItem(productId)}
                      />
                    </motion.div>
                  ))}
              </div>
            </div>
          </div>

          {/* Right — order summary + fulfillment (sticky) */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4"
          >
            <Card className="rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.12)]">
              <CardContent className="space-y-4 xl:p-3 p-1">
                {/* Summary header */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{t("order_summary")}</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${state.paymentMode === "host_pays"
                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                      : "bg-[#f0faf6] text-[#1a3c34] ring-[#1a3c34]/20"
                      }`}
                  >
                    {state.paymentMode === "host_pays" ? (
                      <Crown className="size-3" />
                    ) : (
                      <Users className="size-3" />
                    )}
                    {state.paymentMode === "host_pays" ? t("group_host_pays") : t("group_split_pay")}
                  </span>
                </div>

                {/* Delivery + Payment — consolidated section */}
                <div className="rounded-2xl border border-black/6 bg-[#f9fafb] divide-y divide-black/6">
                  {/* Fulfillment row — read-only in sidebar; left column card handles editing */}
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <FulfillmentIcon className="size-3.5 shrink-0 text-foreground/45" />
                    <span className="min-w-0 flex-1 text-xs font-medium text-foreground/70">
                      {fulfillmentLabel}
                      {state.address && (
                        <span className="block truncate text-[11px] font-normal text-foreground/45">
                          {state.address.fullAddress}
                        </span>
                      )}
                    </span>
                    {state.type === "delivery" && shippingEstimate?.distanceKm && (
                      <span className="shrink-0 text-[11px] font-semibold text-[#1a3c34]">
                        {shippingEstimate.distanceKm.toFixed(1)} km
                      </span>
                    )}
                  </div>

                  {/* Payment type row — "Thay đổi" only here (not duplicated in left column) */}
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    {state.paymentType === "cash" ? (
                      <Banknote className="size-3.5 shrink-0 text-foreground/45" />
                    ) : (
                      <QrCode className="size-3.5 shrink-0 text-foreground/45" />
                    )}
                    <span className="flex-1 text-xs font-medium text-foreground/70">
                      {state.paymentType === "cash" ? t("cash") : t("bank_transfer")}
                    </span>
                  </div>

                  {state.paymentMode === "split" && state.type === "delivery" && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      <Truck className="size-3.5 shrink-0 text-foreground/45" />
                      <span className="flex-1 text-xs font-medium text-foreground/70">{t("shipping_fee")}</span>
                      <span className={`text-[11px] font-semibold ${shippingFeeMode === "host_pays" ? "text-amber-600" : "text-foreground/55"}`}>
                        {shippingFeeMode === "host_pays" ? t("group_shipping_fee_host_pays") : t("group_shipping_fee_split")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Totals */}
                {(() => {
                  const displayShippingFee = isHost && state.status === "collecting"
                    ? localShippingFee
                    : state.shippingFee;
                  const displayFinalAmount = totalAmount - discountAmount + displayShippingFee;
                  return (
                    <>
                      <div className="space-y-2 text-sm text-foreground/70">
                        <div className="flex justify-between">
                          <span>{t("group_subtotal_n", { count: totalItems })}</span>
                          <span className="tabular-nums font-medium text-foreground">{fmtVnd(totalAmount)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-700">
                            <span>{t("group_group_discount", { pct: discountPercent })}</span>
                            <span className="tabular-nums font-medium">-{fmtVnd(discountAmount)}</span>
                          </div>
                        )}
                        {(displayShippingFee > 0 || (isHost && state.status === "collecting" && localType === "delivery")) && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              {t("shipping_fee")}
                              {shippingConfig && <ShippingFeeTooltip config={shippingConfig} />}
                            </span>
                            {isHost && state.status === "collecting" && localShippingFetching ? (
                              <span className="text-xs text-muted">{t("group_calculating_ship")}</span>
                            ) : isHost && state.status === "collecting" && localShippingIsOutOfRange ? (
                              <span className="text-xs font-medium text-danger">{t("out_of_delivery_range")}</span>
                            ) : isHost && state.status === "collecting" && localShippingIsFree ? (
                              <span className="text-xs font-semibold uppercase text-kun-products-forest">{t("free")}</span>
                            ) : (
                              <span className="tabular-nums font-medium">{fmtVnd(displayShippingFee)}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-black/6 pt-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-foreground/70">{t("group_grand_total")}</span>
                          <span className="text-2xl font-bold tabular-nums text-[#1a3c34]">
                            {fmtVnd(displayFinalAmount)}
                          </span>
                        </div>
                        {myAmountBreakdown && myAmountBreakdown.total > 0 && (
                          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f0faf6] px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[#1a3c34]/70">{t("group_your_share")}</span>
                              <ShareBreakdownPopup bd={myAmountBreakdown} />
                            </div>
                            <span className="text-base font-bold tabular-nums text-[#1a3c34]">
                              {fmtVnd(myAmountBreakdown.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {state.status === "completed" && state.order && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
                    <Loader2 className="mx-auto mb-1.5 size-5 animate-spin text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-800">{t("group_order_done")}</p>
                    <p className="mt-0.5 text-xs text-emerald-700">{t("group_order_redirecting")}</p>
                  </div>
                )}

                {state.status === "collecting" && (
                  <p className="text-center text-xs text-foreground/40">
                    {allReady ? t("group_all_ready_hint") : t("group_waiting_hint")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Fulfillment form — host only, collecting state */}
            {isHost && state.status === "collecting" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="overflow-hidden rounded-3xl border border-black/6 bg-white"
              >
                <div className="flex items-center gap-3 border-b border-black/6 px-5 py-4">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#1a3c34]/8">
                    <FulfillmentIcon className="size-4 text-[#1a3c34]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{t("group_fulfillment_card_eyebrow")}</p>
                    <p className="text-sm font-semibold text-foreground">{t("group_fulfillment_card_title")}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex gap-2">
                    {([{ id: "delivery", label: t("type_delivery"), Icon: Truck }, { id: "pickup", label: t("type_pickup"), Icon: ShoppingBag }] as const).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLocalType(id)}
                        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${localType === id ? "bg-kun-primary text-white shadow-sm" : "bg-surface-card text-foreground/60 hover:bg-black/6"}`}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>

                  <CheckoutFulfillmentSection
                    tab={localType === "delivery" ? CHECKOUT_TAB.DELIVERY : CHECKOUT_TAB.PICKUP}
                    deliveryForm={localDeliveryForm}
                    onDeliveryFormChange={(patch) => setLocalDeliveryForm((p) => ({ ...p, ...patch }))}
                    pickupForm={localPickupForm}
                    onPickupFormChange={(patch) => setLocalPickupForm((p) => ({ ...p, ...patch }))}
                    savedAddresses={savedAddresses}
                    selectedAddressId={localSelectedAddressId}
                    onSelectAddress={setLocalSelectedAddressId}
                    storeLocation={storeLocation ? { lat: storeLocation.lat, lng: storeLocation.lng, address: storeLocation.address } : null}
                    profileName={profile?.name}
                    profilePhone={profile?.phone}
                  />

                  <AnimatePresence initial={false}>
                    {localType === "delivery" && (localShippingFetching || localShippingEstimate) && (
                      <motion.div
                        key="ship-badge"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm ${localShippingFetching
                          ? "bg-surface-card text-foreground/50"
                          : localShippingIsOutOfRange
                            ? "bg-red-50 text-red-700"
                            : localShippingIsFree
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-kun-mint/20 text-kun-products-forest"
                          }`}>
                          <div className="flex items-center gap-1.5">
                            {localShippingFetching ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Bike className="size-4" />
                            )}
                            <span className="font-medium">
                              {localShippingFetching
                                ? t("group_calculating_ship")
                                : localShippingIsOutOfRange
                                  ? t("group_out_of_range_badge")
                                  : `${localShippingEstimate!.distanceKm.toFixed(1)} km`
                              }
                            </span>
                          </div>
                          {!localShippingFetching && !localShippingIsOutOfRange && (
                            <span className="font-bold tabular-nums">
                              {localShippingIsFree ? t("group_shipping_free") : formatVnd(localShippingFee)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </motion.aside>
        </div>
      </div>

      {/* Dissolve confirm modal */}
      <AnimatePresence>
        {showLockConfirm && (() => {
          const unconfirmed = state.participants.filter((p) => !p.isReady);
          return (
            <motion.div
              key="lock-confirm-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && setShowLockConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: "spring", damping: 24, stiffness: 380 }}
                className="w-full max-w-sm rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.18)]"
              >
                <div className="px-6 pb-5 pt-8 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
                    <Lock className="size-7 text-amber-500" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {t("group_lock_unconfirmed_title", { count: unconfirmed.length })}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted">{t("group_lock_unconfirmed_desc")}</p>
                  <div className="mt-4 flex flex-col gap-1.5">
                    {unconfirmed.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-xl bg-surface-soft px-3 py-2 text-left">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-black/8 text-xs font-bold text-foreground/60">
                          {p.name[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-foreground">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex divide-x divide-black/6 border-t border-black/6">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => setShowLockConfirm(false)}
                    className="cursor-pointer flex h-13 flex-1 items-center justify-center rounded-bl-3xl text-sm font-semibold text-foreground/70 transition hover:bg-surface-soft disabled:opacity-50"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {
                      setShowLockConfirm(false);
                      if (state.paymentMode === "split" && (state.paymentType ?? "cash") === "cash") {
                        void handleSplitCashCheckout();
                      } else if (state.paymentMode === "host_pays" && (state.paymentType ?? "cash") !== "bank_transfer") {
                        void handleHostCheckout();
                      } else {
                        void withAction(() => lockGroupOrder(token, sessionToken!));
                      }
                    }}
                    className="cursor-pointer flex h-13 flex-1 items-center justify-center gap-1.5 rounded-br-3xl text-sm font-semibold text-[#1a3c34] transition hover:bg-[#f0faf6] disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="size-3.5 animate-spin" />}
                    {t("group_lock_unconfirmed_confirm")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}

        {showDissolveConfirm && (
          <motion.div
            key="dissolve-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowDissolveConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", damping: 24, stiffness: 380 }}
              className="w-full max-w-sm rounded-3xl border border-black/6 bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.18)]"
            >
              {/* Modal body */}
              <div className="px-6 pb-6 pt-8 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
                  <UserX className="size-7 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-foreground">{t("group_dissolve_modal_title")}</h3>
                <p className="mt-1.5 text-sm text-muted">{t("group_dissolve_modal_desc")}</p>
              </div>
              {/* Modal footer — divider + side-by-side buttons */}
              <div className="flex divide-x divide-black/6 border-t border-black/6">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowDissolveConfirm(false)}
                  className="cursor-pointer flex h-13 flex-1 items-center justify-center rounded-bl-3xl text-sm font-semibold text-foreground/70 transition hover:bg-surface-soft disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void handleDissolve()}
                  className="cursor-pointer flex h-13 flex-1 items-center justify-center gap-1.5 rounded-br-3xl text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {actionLoading && <Loader2 className="size-3.5 animate-spin" />}
                  {actionLoading ? t("group_dissolving") : t("group_dissolve_confirm_btn")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isKicked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-black/6 bg-white p-8 text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.18)]">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
              <UserX className="size-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{t("group_kicked_title")}</h3>
            <p className="mt-2 text-sm text-muted">{t("group_kicked_desc")}</p>
            <button
              type="button"
              onClick={() => router.push(ROUTES.HOME)}
              className="mt-6 w-full rounded-full bg-[#1a3c34] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t("group_go_home")}
            </button>
          </div>
        </div>
      )}

      {isDissolved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="w-full max-w-sm rounded-3xl border border-black/6 bg-white p-8 text-center shadow-[0_4px_20px_-8px_rgba(0,0,0,0.18)]"
          >
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
              <Users className="size-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">{t("group_dissolved_title")}</h3>
            <p className="mt-2 text-sm text-muted">{t("group_dissolved_desc")}</p>
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-foreground/45">
              <Loader2 className="size-4 animate-spin" />
              <span>{t("group_go_home")}…</span>
            </div>
            <button
              type="button"
              onClick={() => router.push(ROUTES.HOME)}
              className="mt-3 text-xs font-semibold text-[#1a3c34] underline underline-offset-2 hover:opacity-70"
            >
              {t("group_go_home_now")}
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
}
