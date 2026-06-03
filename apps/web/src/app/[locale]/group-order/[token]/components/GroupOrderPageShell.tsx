"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { GroupOrderCheckoutModal } from "./GroupOrderCheckoutModal";
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
  Loader2,
  Lock,
  LockOpen,
  MapPin,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,

  Truck,
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
import { normalizeOptionGroups, computeOptionSurcharge, formatVnd } from "@/lib/product-options";
import { useAddressesQuery } from "@/services/order/hooks";
import { useShippingEstimateQuery } from "@/services/shipping/hooks";
import { usePublicPaymentConfigQuery } from "@/services/payment-config/hooks";
import { BankTransferQR } from "@/app/[locale]/checkout/components/BankTransferQR";
import {
  fetchGroupOrder,
  joinGroupOrder,
  updateGroupOrderItems,
  markGroupOrderReady,
  lockGroupOrder,
  unlockGroupOrder,
  setGroupOrderFulfillment,
  checkoutHostPays,
  initSplitPayment,
  confirmParticipantPaid,
  fetchGroupOrderConfig,
  type GroupOrderState,
  type GroupOrderItem,
  type GroupDiscountTier,
} from "@/services/group-order/api";
import { useLocale, useTranslations } from "next-intl";
import { getDisplayName } from "@/lib/product-name";

const SESSION_KEY = (token: string) => `group_order_session_${token}`;
const PARTICIPANT_KEY = (token: string) => `group_order_participant_${token}`;


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
type DraftValue = { quantity: number; selectedOptions: Record<string, string>; toppings: ToppingDraft[] };
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
  const basePrice = parseFloat(product.price) * (1 - (product.discountPercent ?? 0) / 100);

  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
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
    setSelectedToppings((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm({
      quantity,
      selectedOptions,
      toppings: toppings
        .filter((t) => selectedToppings.has(t.id))
        .map((t) => ({ toppingId: t.id, name: t.name, price: t.price, nameTranslation: t.nameTranslation })),
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
            <div className="space-y-1.5 rounded-2xl border border-black/6 bg-[#f9fafb] p-2">
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

        <div className="flex items-center justify-between rounded-2xl bg-[#1a3c34]/8 px-4 py-3">
          <span className="text-sm font-semibold text-[#1a3c34]">{t("group_unit_price_label")}</span>
          <span className="text-xl font-bold tabular-nums text-[#1a3c34]">{fmtVnd(unitPrice)}</span>
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
      }),
    );
    return m;
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [customizeTarget, setCustomizeTarget] = useState<ApiProduct | null>(null);

  const { data: categories = [] } = useCategoriesQuery();
  const { data: allProducts = [], isLoading: productsLoading } = useProductsQuery({
    categoryId: activeCategoryId,
  });
  const products = search.trim()
    ? allProducts.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allProducts;

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
            className="relative flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:h-[85vh] sm:max-w-2xl sm:rounded-3xl"
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {products.map((product) => {
                    const draftVal = draft.get(product.id);
                    const qty = draftVal?.quantity ?? 0;
                    const price = parseFloat(product.price);
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
                          {qty > 0 && (
                            <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[#1a3c34] text-[10px] font-bold text-white">
                              {qty}
                            </span>
                          )}
                        </button>

                        <div className="flex flex-1 flex-col justify-between gap-2 p-2.5">
                          <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                            {getDisplayName(product, locale)}
                          </p>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold tabular-nums text-[#26634d]">
                              {fmtVnd(price)}
                            </span>
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
  onConfirmPaid,
  onOpenPicker,
  onRemoveItem,
}: {
  participant: GroupOrderState["participants"][0];
  isMe: boolean;
  isMeHost: boolean;
  groupStatus: GroupOrderState["status"];
  paymentMode: GroupOrderState["paymentMode"];
  onConfirmPaid?: (participantId: string) => void;
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
    <div
      className={`rounded-2xl border p-4 transition-all ${isMe ? "border-[#1a3c34]/20 bg-[#f0faf6]" : "border-black/6 bg-white"
        }`}
    >
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
              {t("group_items_amount", { count: participant.items.length, amount: fmtVnd(participant.subtotal) })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMe && groupStatus === "collecting" && (
            <button
              type="button"
              onClick={onOpenPicker}
              className="flex items-center gap-1 rounded-full bg-[#1a3c34] px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <Plus className="size-3" />
              {t('choose_dish')}
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
        <div className="mt-3 space-y-2 border-t border-black/6 pt-3">
          {participant.items.map((item) => {
            const groups = normalizeOptionGroups(item.product?.optionGroups);
            const resolvedOptions = Object.entries(item.selectedOptions ?? {})
              .map(([groupName, optionLabel]) => {
                const grp = groups.find((g) => g.name === groupName);
                const val = grp?.values.find((v) => v.label === optionLabel);
                return {
                  label: val?.nameTranslation?.[locale] ?? val?.label ?? optionLabel,
                  priceDelta: val?.priceDelta ?? 0,
                };
              })
              .filter((o) => o.label);
            const toppingTotal = item.toppings?.reduce((s, t) => s + t.price, 0) ?? 0;
            const lineTotal = (item.unitPrice + toppingTotal) * item.quantity;
            return (
              <div key={item.id} className="flex items-start gap-2 text-xs">
                {isMe && groupStatus === "collecting" && !participant.isReady && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(item.productId)}
                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-black/6 text-foreground/35 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="size-2.5" />
                  </button>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-start gap-1.5">
                    {!(isMe && groupStatus === "collecting" && !participant.isReady) && (
                      <ChevronRight className="mt-0.5 size-3 shrink-0 text-foreground/25" />
                    )}
                    <span className="font-medium text-foreground/80">
                      {item.product ? getDisplayName(item.product, locale) : "Sản phẩm"} ×{item.quantity}
                    </span>
                  </span>
                  {resolvedOptions.length > 0 && (
                    <p className="pl-[18px] text-[11px] text-foreground/45">
                      {resolvedOptions.map((o) =>
                        o.priceDelta > 0 ? `${o.label} +${formatVnd(o.priceDelta)}` : o.label
                      ).join(" · ")}
                    </p>
                  )}
                  {item.toppings?.map((top) => (
                    <p key={top.toppingId} className="pl-[18px] text-[11px] text-foreground/45">
                      {top.nameTranslation?.[locale] ?? top.name}
                      {top.price > 0 && <span className="ml-1">+{formatVnd(top.price)}</span>}
                    </p>
                  ))}
                  {item.note && (
                    <p className="pl-[18px] text-[11px] italic text-foreground/35">"{item.note}"</p>
                  )}
                </div>
                <span className="shrink-0 tabular-nums font-medium text-foreground/70">
                  {fmtVnd(lineTotal)}
                </span>
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
              {tier.minParticipants}+ người: -{tier.discountPercent}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CopyLinkButton ────────────────────────────────────────────────────────────

function CopyLinkButton({ token: _token }: { token: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // not critical
    }
  };

  return (
    <Button
      size="sm"
      className="gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-foreground/70 hover:bg-black/4"
      onPress={copy}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      {copied ? t("group_copied") : t("group_copy_link")}
    </Button>
  );
}

// ── LoginRequired ─────────────────────────────────────────────────────────────

function LoginRequired({ token }: { token: string }) {
  const t = useTranslations();
  const handleLogin = () => {
    sessionStorage.setItem("pendingGroupOrderJoin", token);
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <Card className="rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.12)]">
          <CardContent className="space-y-5 p-7">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1a3c34]/8">
                <Users className="size-7 text-[#1a3c34]" />
              </div>
              <p className="text-lg font-bold text-foreground">{t("group_login_title")}</p>
              <p className="text-sm text-foreground/55">{t("group_login_desc")}</p>
            </div>
            <div className="rounded-xl border border-dashed border-[#1a3c34]/20 bg-[#f0faf6] px-4 py-3 text-center">
              <p className="text-xs text-foreground/55">{t("group_login_note")}</p>
            </div>
            <Button
              className="w-full rounded-full bg-[#1a3c34] py-3 font-semibold text-white"
              onPress={handleLogin}
            >
              {t("group_login_btn")}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── PaymentSheet ─────────────────────────────────────────────────────────────

function PaymentSheet({
  open,
  current,
  loading,
  onSelect,
  onClose,
}: {
  open: boolean;
  current: "cash" | "bank_transfer";
  loading: boolean;
  onSelect: (t: "cash" | "bank_transfer") => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const opts = [
    { id: "cash" as const, label: t("cash"), desc: t("group_payment_cash_desc_2"), Icon: Banknote },
    { id: "bank_transfer" as const, label: t("bank_transfer"), desc: t("group_payment_transfer_desc_2"), Icon: QrCode },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="w-full rounded-t-3xl bg-white p-5 sm:max-w-sm sm:rounded-3xl"
          >
            <div className="mb-4 flex justify-center sm:hidden">
              <div className="h-1 w-10 rounded-full bg-black/12" />
            </div>

            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
              {t("group_payment_sheet_title")}
            </p>
            <p className="mb-4 text-xs text-foreground/50">{t("group_payment_for_order")}</p>

            <div className="space-y-2">
              {opts.map(({ id, label, desc, Icon }) => {
                const isSelected = current === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={loading}
                    onClick={() => onSelect(id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all disabled:opacity-50 ${isSelected
                      ? "bg-[#1a3c34] text-white shadow-sm"
                      : "bg-[#f7f7f7] text-foreground hover:bg-black/6"
                      }`}
                  >
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-white/15" : "bg-white"}`}>
                      {loading && isSelected
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Icon className="size-4" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className={`text-xs leading-snug ${isSelected ? "text-white/65" : "text-foreground/50"}`}>{desc}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="size-4 shrink-0 text-white/80" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-full border border-black/8 text-sm text-foreground/60 transition hover:bg-black/4"
            >
              {t("group_close")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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

  const [state, setState] = useState<GroupOrderState | null>(null);
  const [config, setConfig] = useState<GroupDiscountTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [myParticipantId, setMyParticipantId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [showFulfillment, setShowFulfillment] = useState(false);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [pendingCheckoutOrder, setPendingCheckoutOrder] = useState<{ id: string; paymentCode: string } | null>(null);
  const splitInitRef = useRef(false);
  const splitCashConfirmRef = useRef(false);

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

  const load = useCallback(async () => {
    try {
      const [go, cfg] = await Promise.all([
        fetchGroupOrder(token),
        fetchGroupOrderConfig().catch(() => ({ id: "default", isEnabled: true, discountTiers: [] })),
      ]);
      setState(go);
      setConfig(cfg.discountTiers);
    } catch {
      setError("Không tìm thấy đơn nhóm này.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state) return;
    const storedSession = localStorage.getItem(SESSION_KEY(token));
    const storedParticipant = localStorage.getItem(PARTICIPANT_KEY(token));
    if (storedSession) {
      setSessionToken(storedSession);
      if (storedParticipant) setMyParticipantId(storedParticipant);
      return;
    }
    if (user) {
      const existing = state.participants.find((p) => p.userId === user.id);
      if (existing) {
        setMyParticipantId(existing.id);
        localStorage.setItem(PARTICIPANT_KEY(token), existing.id);
        return;
      }
    }
    if (state.status === "collecting") {
      if (user) {
        void handleJoin();
      } else {
        setNeedsLogin(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.id, user?.id]);

  const handleJoin = useCallback(async () => {
    setJoining(true);
    try {
      const res = await joinGroupOrder(token);
      setSessionToken(res.sessionToken);
      setMyParticipantId(res.participantId);
      localStorage.setItem(SESSION_KEY(token), res.sessionToken);
      localStorage.setItem(PARTICIPANT_KEY(token), res.participantId);
      const go = await fetchGroupOrder(token);
      setState(go);
    } catch {
      setError("Không thể tham gia đơn nhóm.");
    } finally {
      setJoining(false);
    }
  }, [token]);

  useEffect(() => {
    const socket = io(`${env.API_URL}/group`, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;
    socket.emit("join-room", { token });
    socket.on("updated", (newState: GroupOrderState) => {
      setState(newState);
    });
    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Polling fallback: socket có thể bị miss trên mobile/proxy — poll mỗi 5 giây
  // khi vẫn còn người đang chờ xác nhận chuyển khoản trong đơn nhóm split.
  const hasPendingBankTransfer =
    state?.status === "locked" &&
    state?.paymentMode === "split" &&
    Boolean(state?.participants?.some(
      (p) => p.paymentStatus === "pending" && p.paymentType === "bank_transfer",
    ));

  useEffect(() => {
    if (!hasPendingBankTransfer) return;
    const id = setInterval(() => {
      fetchGroupOrder(token).then(setState).catch(() => { });
    }, 5000);
    return () => clearInterval(id);
  }, [hasPendingBankTransfer, token]);

  useEffect(() => {
    if (state?.status === "completed" && state.order?.paymentCode && !pendingCheckoutOrder) {
      router.push(ROUTES.ORDER_DETAIL(state.order.paymentCode));
    }
  }, [state?.status, state?.order?.paymentCode, router, pendingCheckoutOrder]);

  // Auto-initiate split payment with host's chosen method when order is locked
  useEffect(() => {
    if (
      state?.status === "locked" &&
      state.paymentMode === "split" &&
      me?.paymentStatus === "pending" &&
      me.paymentType === null &&
      me.items.length > 0 &&
      sessionToken &&
      !splitInitRef.current
    ) {
      splitInitRef.current = true;
      void initSplitPayment(token, sessionToken, state.paymentType ?? "cash")
        .then((newState) => setState(newState))
        .catch(() => { splitInitRef.current = false; });
    }
  }, [state?.status, state?.paymentMode, state?.paymentType, me?.paymentStatus, me?.paymentType, me?.items.length, sessionToken, token]);

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
      alert(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setActionLoading(false);
    }
  };

  // Hooks must be before any early returns ─────────────────────────────────

  // Per-participant amount for split mode (discount proportional, shipping split evenly)
  const myAmount = useMemo(() => {
    if (!state || !me || state.paymentMode !== "split" || me.items.length === 0) return 0;
    const activeCount = state.participants.filter((p) => p.items.length > 0).length;
    const discount = resolveDiscount(activeCount, config);
    const discounted = me.subtotal * (1 - discount / 100);
    const shippingShare = activeCount > 0 ? state.shippingFee / activeCount : 0;
    return Math.round(discounted + shippingShare);
  }, [state, me, config]);

  const handleHostCheckout = useCallback(async () => {
    if (!sessionToken || !state) return;
    const paymentType = state.paymentType ?? "cash";
    setActionLoading(true);
    try {
      const res = await checkoutHostPays(token, sessionToken, paymentType);
      const go = res.groupOrder;
      setState(go);
      if (paymentType === "bank_transfer" && go.order) {
        setPendingCheckoutOrder({ id: go.order.id, paymentCode: go.order.paymentCode });
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      alert(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setActionLoading(false);
    }
  }, [sessionToken, state, token]);

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
      alert(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setPickerSaving(false);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    if (!sessionToken || !me) return;
    setPickerSaving(true);
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
      alert(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setPickerSaving(false);
    }
  };

  const handleSetFulfillment = async (payload: {
    type: "delivery" | "pickup";
    addressId?: string;
    shippingFee?: number;
  }) => {
    if (!sessionToken) throw new Error("Chưa đăng nhập.");
    const newState = await setGroupOrderFulfillment(token, sessionToken, {
      ...payload,
      paymentType: state?.paymentType ?? "cash",
    });
    setState(newState);
    setShowFulfillment(false);
  };

  const handleChangePaymentType = async (paymentType: "cash" | "bank_transfer") => {
    if (!sessionToken || !state) return;
    setActionLoading(true);
    try {
      const newState = await setGroupOrderFulfillment(token, sessionToken, {
        type: state.type as "delivery" | "pickup",
        addressId: state.address?.id,
        shippingFee: state.shippingFee,
        paymentType,
      });
      setState(newState);
      setShowPaymentPicker(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message ?? "Có lỗi xảy ra.";
      alert(typeof msg === "string" ? msg : msg.join(", "));
    } finally {
      setActionLoading(false);
    }
  };

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

  if (needsLogin && !sessionToken) {
    return <LoginRequired token={token} />;
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
    state.participants.length > 1 && state.participants.every((p) => p.isReady || p.items.length === 0);

  const FulfillmentIcon =
    state.type === "delivery" ? Truck : state.type === "table" ? Utensils : ShoppingBag;
  const needsAddress = state.type === "delivery" && !state.address;
  const fulfillmentLabel = t(
    state.type === "delivery" ? "type_delivery" :
      state.type === "table" ? "type_table" : "type_pickup"
  );

  return (
    <>
      <PaymentSheet
        open={showPaymentPicker}
        current={state?.paymentType ?? "cash"}
        loading={actionLoading}
        onSelect={(t) => void handleChangePaymentType(t)}
        onClose={() => setShowPaymentPicker(false)}
      />

      {showPicker && me && (
        <ProductPickerDrawer
          open={showPicker}
          onClose={() => setShowPicker(false)}
          initialItems={me.items}
          onSave={handleSaveItems}
          saving={pickerSaving}
        />
      )}

      {showFulfillment && isHost && state.status === "collecting" && (
        <GroupOrderCheckoutModal
          open={showFulfillment}
          onClose={() => setShowFulfillment(false)}
          state={state}
          savedAddresses={savedAddresses}
          onSave={handleSetFulfillment}
          totalAmount={totalAmount}
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
            <CopyLinkButton token={token} />

            {state.status === "locked" && isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 font-semibold text-amber-700 hover:bg-amber-100"
                isDisabled={actionLoading}
                onPress={() => void withAction(() => unlockGroupOrder(token, sessionToken!))}
              >
                <LockOpen className="size-3.5" />
                {t("group_unlock")}
              </Button>
            )}

            {state.status === "collecting" && isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full bg-[#1a3c34] px-4 font-semibold text-white"
                isDisabled={actionLoading || state.participants.length < 2}
                onPress={() => void withAction(() => lockGroupOrder(token, sessionToken!))}
              >
                <Lock className="size-3.5" />
                {t("group_lock")}
              </Button>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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

            {/* Fulfillment row for host (collecting only) */}
            {isHost && state.status === "collecting" && (
              <>
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 }}
                  onClick={() => setShowFulfillment(true)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:shadow-sm ${needsAddress
                    ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                    : "border-black/6 bg-white hover:border-[#1a3c34]/20"
                    }`}
                >
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${needsAddress ? "bg-amber-100" : "bg-[#1a3c34]/8"}`}>
                    <FulfillmentIcon className={`size-4.5 ${needsAddress ? "text-amber-600" : "text-[#1a3c34]"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${needsAddress ? "text-amber-800" : "text-foreground"}`}>
                      {fulfillmentLabel}
                      {needsAddress && <span className="ml-1.5 text-amber-600">· Chưa chọn địa chỉ</span>}
                    </p>
                    {state.address && (
                      <p className="truncate text-xs text-foreground/55">{state.address.fullAddress}</p>
                    )}
                    {!state.address && state.type !== "delivery" && (
                      <p className="text-xs text-foreground/45">Nhấn để thay đổi hình thức</p>
                    )}
                    {needsAddress && (
                      <p className="text-xs text-amber-600/80">{t("group_need_addr_hint")}</p>
                    )}
                  </div>
                  <ChevronRight className={`size-4 shrink-0 ${needsAddress ? "text-amber-400" : "text-foreground/25"}`} />
                </motion.button>

              </>
            )}

            {/* Fulfilled info (read-only, locked/completed) */}
            {(state.status === "locked" || state.status === "completed") &&
              (state.address || state.type !== "delivery") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 }}
                  className="flex items-center gap-3 rounded-2xl border border-black/6 bg-white p-4"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1a3c34]/8">
                    <FulfillmentIcon className="size-4.5 text-[#1a3c34]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{fulfillmentLabel}</p>
                    {state.address && (
                      <p className="truncate text-xs text-foreground/55">{state.address.fullAddress}</p>
                    )}
                    {state.table && (
                      <p className="text-xs text-foreground/55">
                        Bàn {state.table.name} · {state.table.area}
                      </p>
                    )}
                    {isHost && state.paymentMode === "host_pays" && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-foreground/50">
                        {state.paymentType === "cash" ? (
                          <Banknote className="size-3 shrink-0" />
                        ) : (
                          <QrCode className="size-3 shrink-0" />
                        )}
                        {state.paymentType === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                      </p>
                    )}
                  </div>
                  {state.shippingFee > 0 && (
                    <span className="text-sm font-semibold tabular-nums text-foreground/70">
                      +{fmtVnd(state.shippingFee)}
                    </span>
                  )}
                </motion.div>
              )}

            {/* Participants */}
            <div className="flex flex-col gap-3">
              {state.participants.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07 + i * 0.04 }}
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
                    onOpenPicker={() => setShowPicker(true)}
                    onRemoveItem={(productId) => void handleRemoveItem(productId)}
                  />
                </motion.div>
              ))}
            </div>

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

            {/* Split payment section */}
            {me &&
              state.status === "locked" &&
              state.paymentMode === "split" &&
              me.paymentStatus === "pending" &&
              me.items.length > 0 && (
                <div className="rounded-2xl border border-black/6 bg-white p-4">
                  {me.paymentType === null ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="size-4 animate-spin text-[#1a3c34]" />
                      <span className="text-sm text-foreground/55">{t("group_init_payment")}</span>
                    </div>
                  ) : me.paymentType === "cash" ? (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <Banknote className="size-4 text-[#1a3c34]" />
                        <p className="text-sm font-semibold text-foreground">{t("group_split_cash_title")}</p>
                      </div>
                      <div className="mb-3 flex items-center justify-between rounded-xl bg-[#f0faf6] px-4 py-3">
                        <span className="text-sm text-foreground/65">{t("group_split_my_share")}</span>
                        <span className="text-lg font-bold tabular-nums text-[#1a3c34]">{fmtVnd(myAmount)}</span>
                      </div>
                      {discountPercent > 0 && (
                        <p className="mb-3 text-xs text-foreground/45">
                          {state.shippingFee > 0
                            ? t("group_incl_discount_ship", { pct: discountPercent })
                            : t("group_incl_discount", { pct: discountPercent })}
                        </p>
                      )}
                      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#1a3c34]/20 bg-[#f0faf6] px-3 py-3">
                        <Bike className="size-4 shrink-0 text-[#1a3c34]" />
                        <p className="text-xs text-[#1a3c34]">{t("group_cash_delivery_note")}</p>
                      </div>
                    </>
                  ) : me.paymentQrToken ? (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <QrCode className="size-4 text-[#1a3c34]" />
                        <p className="text-sm font-semibold text-foreground">{t("group_split_transfer_title")}</p>
                      </div>
                      <div className="mb-3 flex flex-col items-center gap-3">
                        {payConfig?.bankCode && payConfig?.accountNumber ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://qr.sepay.vn/img?${new URLSearchParams({ bank: payConfig.bankCode, acc: payConfig.accountNumber, template: "", amount: String(myAmount), des: me.paymentQrToken.slice(0, 12).toUpperCase() }).toString()}`}
                            alt="QR chuyển khoản"
                            className="h-44 w-44 rounded-2xl ring-1 ring-black/8"
                          />
                        ) : (
                          <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-surface-card ring-1 ring-black/8">
                            <QrCode className="size-10 text-foreground/25" />
                          </div>
                        )}
                        {payConfig && (
                          <div className="w-full space-y-1.5 rounded-xl bg-[#f0faf6] px-4 py-3 text-xs">
                            {payConfig.bankCode && <div className="flex justify-between"><span className="text-foreground/50">{t("group_bank")}</span><span className="font-semibold">{payConfig.bankCode}</span></div>}
                            {payConfig.accountNumber && <div className="flex justify-between"><span className="text-foreground/50">{t("group_account_no")}</span><span className="font-mono font-semibold">{payConfig.accountNumber}</span></div>}
                            <div className="flex justify-between"><span className="text-foreground/50">{t("group_amount")}</span><span className="font-bold text-[#1a3c34]">{fmtVnd(myAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-foreground/50">{t("group_transfer_note")}</span><span className="font-mono font-semibold">{me.paymentQrToken.slice(0, 12).toUpperCase()}</span></div>
                          </div>
                        )}
                        {discountPercent > 0 && (
                          <p className="w-full text-xs text-foreground/45">
                            {state.shippingFee > 0
                              ? t("group_incl_discount_ship", { pct: discountPercent })
                              : t("group_incl_discount", { pct: discountPercent })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#1a3c34]/20 bg-[#f0faf6] py-3">
                        <Loader2 className="size-4 animate-spin text-[#1a3c34]" />
                        <span className="text-sm font-medium text-[#1a3c34]">{t("group_split_waiting")}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="size-4 animate-spin text-[#1a3c34]" />
                      <span className="text-sm text-foreground/55">{t("group_gen_qr")}</span>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Right — order summary */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:sticky lg:top-28"
          >
            <Card className="rounded-3xl border border-black/6 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.12)]">
              <CardContent className="space-y-4 p-6">
                {/* Summary header */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{t("group_order_summary")}</p>
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
                    {isHost && state.status === "collecting" && (
                      <button
                        type="button"
                        onClick={() => setShowPaymentPicker(true)}
                        className="shrink-0 text-[11px] font-semibold text-[#1a3c34] hover:underline"
                      >
                        {t("group_change")}
                      </button>
                    )}
                  </div>
                </div>

                {needsAddress && isHost && state.status === "collecting" && (
                  <button
                    type="button"
                    onClick={() => setShowFulfillment(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    <MapPin className="size-3.5" />
                    {t("group_set_address_btn")}
                  </button>
                )}

                {/* Totals */}
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
                  {state.shippingFee > 0 && (
                    <div className="flex justify-between">
                      <span>{t("shipping_fee")}</span>
                      <span className="tabular-nums font-medium">{fmtVnd(state.shippingFee)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-black/6 pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground/70">{t("group_grand_total")}</span>
                    <span className="text-2xl font-bold tabular-nums text-[#1a3c34]">
                      {fmtVnd(finalAmount)}
                    </span>
                  </div>
                </div>

                {/* Host pays checkout */}
                {state.status === "locked" && state.paymentMode === "host_pays" && isHost && !pendingCheckoutOrder && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-foreground/55">{t("group_host_pays_desc")}</p>
                    <Button
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-sm font-semibold text-white"
                      isDisabled={actionLoading}
                      onPress={() => void handleHostCheckout()}
                    >
                      {state.paymentType === "cash" ? (
                        <Banknote className="size-4" />
                      ) : (
                        <QrCode className="size-4" />
                      )}
                      {state.paymentType === "cash" ? t("group_pay_cash_btn") : t("group_pay_transfer_btn")}
                    </Button>
                  </div>
                )}

                {pendingCheckoutOrder && state.paymentMode === "host_pays" && (
                  <div className="pt-2">
                    <BankTransferQR
                      orderId={pendingCheckoutOrder.id}
                      paymentCode={pendingCheckoutOrder.paymentCode}
                      total={finalAmount}
                      createdAt={new Date()}
                      onPaid={() => {
                        setPendingCheckoutOrder(null);
                        router.push(ROUTES.ORDER_DETAIL(pendingCheckoutOrder.paymentCode));
                      }}
                      onExpired={() => {
                        setPendingCheckoutOrder(null);
                        router.push(ROUTES.ORDER_DETAIL(pendingCheckoutOrder.paymentCode));
                      }}
                    />
                  </div>
                )}

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
          </motion.aside>
        </div>
      </div>
    </>
  );
}
