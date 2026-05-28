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
import { Button, Card, CardContent, Checkbox } from "@heroui/react";
import { env } from "@/config/env";
import { useAuthStore } from "@/store/auth-store";
import { useProductsQuery } from "@/services/product/hooks";
import type { ApiProduct } from "@/services/product/types";
import { useCategoriesQuery } from "@/services/category/hooks";
import { useToppingsQuery } from "@/services/topping/hooks";
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

const SESSION_KEY = (token: string) => `group_order_session_${token}`;
const PARTICIPANT_KEY = (token: string) => `group_order_participant_${token}`;

const FULFILLMENT_LABEL: Record<string, string> = {
  delivery: "Giao hàng",
  pickup: "Tại quán",
  table: "Tại bàn",
};

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function resolveDiscount(participantCount: number, tiers: GroupDiscountTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.minParticipants - a.minParticipants);
  return sorted.find((t) => participantCount >= t.minParticipants)?.discountPercent ?? 0;
}

function StatusBadge({ status }: { status: GroupOrderState["status"] }) {
  const map = {
    collecting: { label: "Đang thu thập", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    locked: { label: "Đã khóa", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    completed: { label: "Hoàn thành", cls: "bg-green-50 text-green-700 ring-green-200" },
    cancelled: { label: "Đã hủy", cls: "bg-red-50 text-red-600 ring-red-200" },
  };
  const { label, cls } = map[status] ?? map.collecting;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${cls}`}>
      {label}
    </span>
  );
}

type ToppingDraft = { toppingId: string; name: string; price: number };
type DraftValue = { quantity: number; selectedOptions: Record<string, string>; toppings: ToppingDraft[] };
type DraftItem = DraftValue & { productId: string };

// ── ProductCustomizeSheet ─────────────────────────────────────────────────────

function ProductCustomizeSheet({
  product,
  toppings,
  initial,
  onConfirm,
  onClose,
}: {
  product: ApiProduct;
  toppings: { id: string; name: string; price: string }[];
  initial?: DraftValue;
  onConfirm: (value: DraftValue) => void;
  onClose: () => void;
}) {
  const optionGroups = normalizeOptionGroups(product.optionGroups);
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
    .reduce((s, t) => s + parseFloat(t.price), 0);
  const unitPrice = basePrice + optionSurcharge + toppingTotal;

  const MAX_TOPPINGS = 2;

  const toggleTopping = (id: string, checked: boolean) => {
    setSelectedToppings((prev) => {
      if (checked && prev.size >= MAX_TOPPINGS) return prev;
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
        .map((t) => ({ toppingId: t.id, name: t.name, price: parseFloat(t.price) })),
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">Tuỳ chọn</p>
          <h3 className="truncate text-sm font-bold text-foreground">{product.name}</h3>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {optionGroups.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-black/6 bg-[#f9fafb] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">Lựa chọn</p>
            {optionGroups.map((grp) => (
              <div key={grp.id} className="space-y-1.5">
                <p className="text-xs font-semibold text-foreground">{grp.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {grp.values.map((v) => {
                    const active = selectedOptions[grp.name] === v.label;
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
                        {v.label}
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
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">Topping</p>
              <p className="text-[10px] font-semibold text-foreground/40">
                {selectedToppings.size}/{MAX_TOPPINGS} đã chọn
              </p>
            </div>
            <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-2xl border border-black/6 bg-[#f9fafb] p-2">
              {toppings.map((top) => {
                const active = selectedToppings.has(top.id);
                const disabled = !active && selectedToppings.size >= MAX_TOPPINGS;
                return (
                  <label
                    key={top.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      active
                        ? "cursor-pointer border-[#1a3c34]/30 bg-[#f0faf6]"
                        : disabled
                        ? "cursor-not-allowed border-transparent bg-white opacity-40"
                        : "cursor-pointer border-transparent bg-white hover:border-black/8"
                    }`}
                  >
                    <Checkbox
                      isSelected={active}
                      isDisabled={disabled}
                      onChange={(v) => toggleTopping(top.id, v)}
                      aria-label={top.name}
                    />
                    <span className={`flex-1 text-sm font-medium ${active ? "text-[#1a3c34]" : "text-foreground"}`}>
                      {top.name}
                    </span>
                    <span className={`text-sm tabular-nums ${active ? "font-semibold text-[#1a3c34]" : "text-foreground/50"}`}>
                      +{formatVnd(top.price)}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedToppings.size >= MAX_TOPPINGS && (
              <p className="text-[11px] text-foreground/45">
                Đã đạt giới hạn {MAX_TOPPINGS} topping. Bỏ chọn để thay đổi.
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">Số lượng</p>
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
          <span className="text-sm font-semibold text-[#1a3c34]">Đơn giá</span>
          <span className="text-xl font-bold tabular-nums text-[#1a3c34]">{fmtVnd(unitPrice)}</span>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/6 px-5 py-4">
        <Button
          className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#1a3c34] text-base font-semibold text-white"
          onPress={handleConfirm}
        >
          <Check className="size-5" />
          {initial ? "Cập nhật món" : "Thêm vào đơn"}
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
  const { data: toppings = [] } = useToppingsQuery();

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
                  toppings={toppings}
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/40">Thực đơn</p>
                <h2 className="text-base font-bold text-foreground">Chọn món của bạn</h2>
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
                  placeholder="Tìm món…"
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
                  Tất cả
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
                  Không tìm thấy món nào
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
                              alt={product.name}
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
                            {product.name}
                          </p>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold tabular-nums text-[#26634d]">
                              {fmtVnd(price)}
                            </span>
                            {unavailable ? (
                              <span className="text-[10px] text-foreground/40">Hết hàng</span>
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
                {saving ? "Đang lưu…" : totalCount > 0 ? `Lưu ${totalCount} món` : "Chưa chọn món nào"}
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
}: {
  participant: GroupOrderState["participants"][0];
  isMe: boolean;
  isMeHost: boolean;
  groupStatus: GroupOrderState["status"];
  paymentMode: GroupOrderState["paymentMode"];
  onConfirmPaid?: (participantId: string) => void;
  onOpenPicker?: () => void;
}) {
  const canConfirm =
    groupStatus === "locked" &&
    paymentMode === "split" &&
    participant.paymentStatus === "pending" &&
    participant.items.length > 0 &&
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
                  (bạn)
                </span>
              )}
            </p>
            <p className="text-xs text-foreground/50">
              {participant.items.length} món · {fmtVnd(participant.subtotal)}
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
              Chọn món
            </button>
          )}
          {participant.isReady && groupStatus === "collecting" && (
            <CheckCircle2 className="size-4 text-emerald-500" />
          )}
          {paymentMode === "split" && groupStatus === "locked" && (
            participant.paymentStatus === "paid" ? (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                <Check className="size-3" /> Đã thanh toán
              </span>
            ) : participant.items.length > 0 && canConfirm ? (
              <Button
                size="sm"
                className="rounded-full bg-[#1a3c34] px-3 py-1 text-xs font-semibold text-white"
                onPress={() => onConfirmPaid?.(participant.id)}
              >
                Xác nhận đã TT
              </Button>
            ) : null
          )}
        </div>
      </div>

      {participant.items.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-black/6 pt-3">
          {participant.items.map((item) => {
            const optionValues = Object.values(item.selectedOptions ?? {}).filter(Boolean);
            const toppingTotal = item.toppings?.reduce((s, t) => s + t.price, 0) ?? 0;
            const lineTotal = (item.unitPrice + toppingTotal) * item.quantity;
            return (
              <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-start gap-1.5">
                    <ChevronRight className="mt-0.5 size-3 shrink-0 text-foreground/25" />
                    <span className="font-medium text-foreground/80">
                      {item.product?.name ?? "Sản phẩm"} ×{item.quantity}
                    </span>
                  </span>
                  {optionValues.length > 0 && (
                    <p className="pl-[18px] text-[11px] text-foreground/45">
                      {optionValues.join(" · ")}
                    </p>
                  )}
                  {item.toppings?.length > 0 && (
                    <p className="pl-[18px] text-[11px] text-foreground/45">
                      +{item.toppings.map((t) => t.name).join(", ")}
                    </p>
                  )}
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
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minParticipants - b.minParticipants);
  const current = resolveDiscount(participantCount, tiers);
  const next = sorted.find((t) => t.minParticipants > participantCount);

  return (
    <div className="rounded-2xl border border-dashed border-[#1a3c34]/30 bg-gradient-to-br from-[#f0faf6] to-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[#1a3c34]" />
          <span className="text-sm font-semibold text-[#1a3c34]">Ưu đãi nhóm</span>
        </div>
        {current > 0 ? (
          <span className="rounded-full bg-[#1a3c34] px-3 py-0.5 text-xs font-bold text-white">
            -{current}% đang áp dụng
          </span>
        ) : next ? (
          <span className="text-xs text-foreground/60">
            Thêm {next.minParticipants - participantCount} người → -{next.discountPercent}%
          </span>
        ) : null}
      </div>
      {tiers.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {sorted.map((t) => (
            <div
              key={t.minParticipants}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${participantCount >= t.minParticipants
                ? "bg-[#1a3c34] text-white ring-[#1a3c34]"
                : "bg-white text-foreground/50 ring-black/10"
                }`}
            >
              {t.minParticipants}+ người: -{t.discountPercent}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CopyLinkButton ────────────────────────────────────────────────────────────

function CopyLinkButton({ token: _token }: { token: string }) {
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
      {copied ? "Đã sao chép!" : "Sao chép link"}
    </Button>
  );
}

// ── LoginRequired ─────────────────────────────────────────────────────────────

function LoginRequired({ token }: { token: string }) {
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
              <p className="text-lg font-bold text-foreground">Bạn được mời vào đơn nhóm</p>
              <p className="text-sm text-foreground/55">
                Đăng nhập để bắt đầu chọn món cùng nhóm
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-[#1a3c34]/20 bg-[#f0faf6] px-4 py-3 text-center">
              <p className="text-xs text-foreground/55">
                Yêu cầu tài khoản để đảm bảo mỗi người chỉ tham gia một lần và nhận ưu đãi nhóm
                chính xác.
              </p>
            </div>
            <Button
              className="w-full rounded-full bg-[#1a3c34] py-3 font-semibold text-white"
              onPress={handleLogin}
            >
              Đăng nhập để tham gia
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── GroupOrderPageShell ───────────────────────────────────────────────────────

export function GroupOrderPageShell() {
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
  const [pendingCheckoutOrder, setPendingCheckoutOrder] = useState<{ id: string; paymentCode: string } | null>(null);
  const splitInitRef = useRef(false);

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

  const handleSetFulfillment = async (payload: {
    type: "delivery" | "pickup";
    addressId?: string;
    shippingFee?: number;
    paymentType: "cash" | "bank_transfer";
  }) => {
    if (!sessionToken) throw new Error("Chưa đăng nhập.");
    const newState = await setGroupOrderFulfillment(token, sessionToken, payload);
    setState(newState);
    setShowFulfillment(false);
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

  return (
    <>
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
              Đơn hàng nhóm
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Cùng chọn món nhé!
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={state.status} />
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                  state.paymentMode === "host_pays"
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-[#f0faf6] text-[#1a3c34] ring-[#1a3c34]/20"
                }`}
              >
                {state.paymentMode === "host_pays" ? (
                  <Crown className="size-3" />
                ) : (
                  <Users className="size-3" />
                )}
                {state.paymentMode === "host_pays" ? "Chủ nhóm trả" : "Mỗi người tự trả"}
              </span>
              <span className="text-xs text-foreground/50">
                <Users className="mr-1 inline-block size-3.5" />
                {state.participants.length} thành viên
              </span>
              <span className="text-xs text-foreground/40">
                <Clock className="mr-1 inline-block size-3.5" />
                Hết hạn{" "}
                {new Date(state.expiresAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton token={token} />

            {/* Unlock button — host only, locked state */}
            {state.status === "locked" && isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 font-semibold text-amber-700 hover:bg-amber-100"
                isDisabled={actionLoading}
                onPress={() => void withAction(() => unlockGroupOrder(token, sessionToken!))}
              >
                <LockOpen className="size-3.5" />
                Mở khóa
              </Button>
            )}

            {/* Lock button — host only, collecting state */}
            {state.status === "collecting" && isHost && (
              <Button
                size="sm"
                className="gap-1.5 rounded-full bg-[#1a3c34] px-4 font-semibold text-white"
                isDisabled={actionLoading || state.participants.length < 2}
                onPress={() => void withAction(() => lockGroupOrder(token, sessionToken!))}
              >
                <Lock className="size-3.5" />
                Khóa đơn
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
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${needsAddress ? "bg-amber-100" : "bg-[#1a3c34]/8"
                    }`}
                >
                  <FulfillmentIcon
                    className={`size-4.5 ${needsAddress ? "text-amber-600" : "text-[#1a3c34]"}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${needsAddress ? "text-amber-800" : "text-foreground"}`}
                  >
                    {FULFILLMENT_LABEL[state.type] ?? state.type}
                    {needsAddress && (
                      <span className="ml-1.5 text-amber-600">· Chưa chọn địa chỉ</span>
                    )}
                  </p>
                  {state.address && (
                    <p className="truncate text-xs text-foreground/55">{state.address.fullAddress}</p>
                  )}
                  {!state.address && state.type !== "delivery" && (
                    <p className="text-xs text-foreground/45">Nhấn để thay đổi hình thức</p>
                  )}
                  {needsAddress && (
                    <p className="text-xs text-amber-600/80">
                      Thiết lập địa chỉ trước khi khóa đơn
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-xs text-foreground/50">
                    {state.paymentType === "cash" ? (
                      <Banknote className="size-3 shrink-0" />
                    ) : (
                      <QrCode className="size-3 shrink-0" />
                    )}
                    {state.paymentType === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                  </p>
                </div>
                <ChevronRight
                  className={`size-4 shrink-0 ${needsAddress ? "text-amber-400" : "text-foreground/25"}`}
                />
              </motion.button>
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
                    <p className="text-sm font-semibold text-foreground">
                      {FULFILLMENT_LABEL[state.type] ?? state.type}
                    </p>
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
                    ? `Sửa món (${me.items.reduce((s, i) => s + i.quantity, 0)})`
                    : "Chọn món"}
                </Button>
                <Button
                  className="flex-1 rounded-full bg-[#1a3c34] py-3 font-semibold text-white"
                  isDisabled={actionLoading || me.items.length === 0}
                  onPress={() =>
                    void withAction(() => markGroupOrderReady(token, sessionToken!))
                  }
                >
                  <CheckCircle2 className="mr-1 size-4" />
                  Xác nhận
                </Button>
              </div>
            )}

            {me && me.isReady && state.status === "collecting" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <CheckCircle2 className="mx-auto mb-1 size-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Bạn đã xác nhận xong!</p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Chờ các thành viên khác và chủ nhóm khóa đơn
                </p>
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
                      <span className="text-sm text-foreground/55">Đang khởi tạo thanh toán…</span>
                    </div>
                  ) : me.paymentType === "cash" ? (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <Banknote className="size-4 text-[#1a3c34]" />
                        <p className="text-sm font-semibold text-foreground">Thanh toán tiền mặt</p>
                      </div>
                      <div className="mb-3 flex items-center justify-between rounded-xl bg-[#f0faf6] px-4 py-3">
                        <span className="text-sm text-foreground/65">Phần của bạn</span>
                        <span className="text-lg font-bold tabular-nums text-[#1a3c34]">{fmtVnd(myAmount)}</span>
                      </div>
                      {discountPercent > 0 && (
                        <p className="mb-2 text-xs text-foreground/45">
                          Đã bao gồm -{discountPercent}% giảm giá nhóm{state.shippingFee > 0 ? ` và phí ship chia đều` : ""}
                        </p>
                      )}
                      <Button
                        className="w-full rounded-full bg-[#1a3c34] py-3 font-semibold text-white"
                        isDisabled={actionLoading}
                        onPress={() => void withAction(() => confirmParticipantPaid(token, sessionToken!, me.id))}
                      >
                        <Check className="mr-1.5 size-4" />
                        Tôi đã trả tiền mặt
                      </Button>
                    </>
                  ) : me.paymentQrToken ? (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <QrCode className="size-4 text-[#1a3c34]" />
                        <p className="text-sm font-semibold text-foreground">Chuyển khoản ngân hàng</p>
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
                            {payConfig.bankCode && <div className="flex justify-between"><span className="text-foreground/50">Ngân hàng</span><span className="font-semibold">{payConfig.bankCode}</span></div>}
                            {payConfig.accountNumber && <div className="flex justify-between"><span className="text-foreground/50">Số tài khoản</span><span className="font-mono font-semibold">{payConfig.accountNumber}</span></div>}
                            <div className="flex justify-between"><span className="text-foreground/50">Số tiền</span><span className="font-bold text-[#1a3c34]">{fmtVnd(myAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-foreground/50">Nội dung CK</span><span className="font-mono font-semibold">{me.paymentQrToken.slice(0, 12).toUpperCase()}</span></div>
                          </div>
                        )}
                        {discountPercent > 0 && (
                          <p className="w-full text-xs text-foreground/45">
                            Đã bao gồm -{discountPercent}% giảm giá nhóm{state.shippingFee > 0 ? ` và phí ship chia đều` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#1a3c34]/20 bg-[#f0faf6] py-3">
                        <Loader2 className="size-4 animate-spin text-[#1a3c34]" />
                        <span className="text-sm font-medium text-[#1a3c34]">Đang chờ xác nhận thanh toán…</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="size-4 animate-spin text-[#1a3c34]" />
                      <span className="text-sm text-foreground/55">Đang tạo mã QR…</span>
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Tổng kết đơn</p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                      state.paymentMode === "host_pays"
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : "bg-[#f0faf6] text-[#1a3c34] ring-[#1a3c34]/20"
                    }`}
                  >
                    {state.paymentMode === "host_pays" ? (
                      <Crown className="size-3" />
                    ) : (
                      <Users className="size-3" />
                    )}
                    {state.paymentMode === "host_pays" ? "Chủ nhóm trả" : "Mỗi người tự trả"}
                  </span>
                </div>

                {/* Fulfillment chip */}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-black/6 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FulfillmentIcon className="size-3.5 text-foreground/50" />
                    <span className="text-xs font-medium text-foreground/70">
                      {FULFILLMENT_LABEL[state.type] ?? state.type}
                    </span>
                  </div>
                  {isHost && state.status === "collecting" && (
                    <button
                      type="button"
                      onClick={() => setShowFulfillment(true)}
                      className="text-[11px] font-semibold text-[#1a3c34] hover:underline"
                    >
                      Thay đổi
                    </button>
                  )}
                </div>

                {/* Payment method row */}
                {isHost && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-black/6 px-3 py-2">
                    <div className="flex items-center gap-2">
                      {state.paymentType === "cash" ? (
                        <Banknote className="size-3.5 text-foreground/50" />
                      ) : (
                        <QrCode className="size-3.5 text-foreground/50" />
                      )}
                      <span className="text-xs font-medium text-foreground/70">
                        {state.paymentType === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                      </span>
                    </div>
                    {state.status === "collecting" && (
                      <button
                        type="button"
                        onClick={() => setShowFulfillment(true)}
                        className="text-[11px] font-semibold text-[#1a3c34] hover:underline"
                      >
                        Thay đổi
                      </button>
                    )}
                  </div>
                )}

                {state.address && (
                  <div className="flex items-start gap-1.5 rounded-xl bg-[#f9fafb] px-3 py-2">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-foreground/40" />
                    <p className="text-xs leading-snug text-foreground/60">{state.address.fullAddress}</p>
                  </div>
                )}

                {/* Shipping distance badge */}
                {state.type === "delivery" && shippingEstimate?.distanceKm && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#1a3c34]/12 bg-[#f0faf6] px-3 py-2">
                    <Truck className="size-3.5 shrink-0 text-[#1a3c34]/60" />
                    <span className="text-xs font-semibold text-[#1a3c34]">
                      {shippingEstimate.distanceKm.toFixed(1)} km
                    </span>
                    {state.shippingFee > 0 && (
                      <span className="ml-auto text-xs tabular-nums text-foreground/50">
                        {fmtVnd(state.shippingFee)}
                      </span>
                    )}
                  </div>
                )}

                {needsAddress && isHost && state.status === "collecting" && (
                  <button
                    type="button"
                    onClick={() => setShowFulfillment(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    <MapPin className="size-3.5" />
                    Chọn địa chỉ giao hàng
                  </button>
                )}

                {/* Totals */}
                <div className="space-y-2 text-sm text-foreground/70">
                  <div className="flex justify-between">
                    <span>Tạm tính ({totalItems} món)</span>
                    <span className="tabular-nums font-medium text-foreground">{fmtVnd(totalAmount)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Giảm giá nhóm (-{discountPercent}%)</span>
                      <span className="tabular-nums font-medium">-{fmtVnd(discountAmount)}</span>
                    </div>
                  )}
                  {state.shippingFee > 0 && (
                    <div className="flex justify-between">
                      <span>Phí vận chuyển</span>
                      <span className="tabular-nums font-medium">{fmtVnd(state.shippingFee)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-black/6 pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground/70">Thành tiền</span>
                    <span className="text-2xl font-bold tabular-nums text-[#1a3c34]">
                      {fmtVnd(finalAmount)}
                    </span>
                  </div>
                </div>

                {/* Host pays checkout */}
                {state.status === "locked" && state.paymentMode === "host_pays" && isHost && !pendingCheckoutOrder && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-foreground/55">
                      Bạn (chủ nhóm) sẽ thanh toán toàn bộ đơn:
                    </p>
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
                      {state.paymentType === "cash" ? "Thanh toán tiền mặt" : "Thanh toán chuyển khoản"}
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
                    <p className="text-sm font-semibold text-emerald-800">Đơn đã tạo thành công!</p>
                    <p className="mt-0.5 text-xs text-emerald-700">Đang chuyển đến chi tiết đơn…</p>
                  </div>
                )}

                {state.status === "collecting" && (
                  <p className="text-center text-xs text-foreground/40">
                    {allReady
                      ? "Tất cả đã sẵn sàng — chủ nhóm có thể khóa đơn"
                      : "Chờ tất cả thành viên chọn xong"}
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
