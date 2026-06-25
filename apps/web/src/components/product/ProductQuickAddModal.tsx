"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { X, ShoppingCart, Check, Loader2, Minus, Plus, ArrowRight, StickyNote } from "lucide-react";
import { useAddToCartMutation, useUpdateCartItemMutation } from "@/services/cart/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import {
  normalizeOptionGroups,
  computeOptionSurcharge,
  formatVnd,
} from "@/lib/product-options";
import type { ApiCartItem } from "@/services/cart/types";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayName, getValueLabel, getDisplayDescription } from "@/lib/product-name";


const PLACEHOLDER_BG = [
  "#1a3c34", "#2d1a0a", "#0d2035", "#1a0d2e",
  "#1a2e0d", "#2e1a0d", "#0d2e2e", "#2e2a0d",
] as const;

// Accepts both ApiProduct and ApiCartProduct shapes
type ModalProduct = {
  id: string;
  name: string;
  nameTranslation?: Record<string, string> | null;
  slug: string;
  price: string;
  imageUrls: string[];
  discountPercent: number;
  finalPrice?: number;
  optionGroups: unknown;
  toppings?: { id: string; name: string; price: number; nameTranslation?: Record<string, string> | null; isActive?: boolean }[];
  category: { name: string; nameTranslation?: Record<string, string> | null };
  description?: string | null;
  descriptionTranslation?: Record<string, string> | null;
  isSoldOut?: boolean;
};

export type GroupOrderDraftValue = {
  quantity: number;
  selectedOptions: Record<string, string>;
  toppings: Array<{ toppingId: string; name: string; price: number; nameTranslation?: Record<string, string> }>;
  note?: string;
};

type Props = {
  product?: ModalProduct | null;
  productIndex?: number;
  open: boolean;
  onClose: () => void;
  editItem?: ApiCartItem | null;
  onGroupConfirm?: (value: GroupOrderDraftValue) => void;
  groupInitial?: GroupOrderDraftValue;
};

export function ProductQuickAddModal({ product, productIndex = 0, open, onClose, editItem, onGroupConfirm, groupInitial }: Props) {
  const isGroupOrderMode = !!onGroupConfirm;
  const isEditMode = !!editItem;
  const t = useTranslations();
  const locale = useLocale();
  const accessToken = useAuthStore((s) => s.accessToken);

  const resolvedProduct: ModalProduct | null = product ?? editItem?.product ?? null;
  const toppings = (resolvedProduct?.toppings ?? []).filter((top) => top.isActive !== false);

  const optionGroups = useMemo(
    () => (resolvedProduct ? normalizeOptionGroups(resolvedProduct.optionGroups) : []),
    [resolvedProduct],
  );

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  useEffect(() => {
    if (!open || !resolvedProduct) return;
    setActiveImageIdx(0);
    setAddedFeedback(false);

    if (isEditMode && editItem) {
      setQuantity(editItem.quantity);
      setSelectedToppings(new Set((editItem.toppings ?? []).map((top) => top.toppingId)));
      const opts: Record<string, string> = {};
      for (const grp of optionGroups) {
        opts[grp.name] =
          editItem.selectedOptions[grp.name] ??
          editItem.selectedOptions[grp.id] ??
          grp.values[0]?.label ??
          "";
      }
      setSelectedOptions(opts);
      setNote(editItem.note ?? "");
    } else if (groupInitial) {
      setQuantity(groupInitial.quantity ?? 1);
      setSelectedToppings(new Set(groupInitial.toppings?.map((t) => t.toppingId) ?? []));
      const opts: Record<string, string> = {};
      for (const grp of optionGroups) {
        opts[grp.name] = groupInitial.selectedOptions?.[grp.name] ?? grp.values[0]?.label ?? "";
      }
      setSelectedOptions(opts);
      setNote(groupInitial.note ?? "");
    } else {
      const init: Record<string, string> = {};
      for (const g of optionGroups) {
        if (g.values[0]) init[g.name] = g.values[0].label;
      }
      setSelectedOptions(init);
      setSelectedToppings(new Set());
      setQuantity(1);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const { mutate: addToCart, isPending: isAdding } = useAddToCartMutation();
  const { mutate: updateItem, isPending: isUpdating } = useUpdateCartItemMutation();
  const addLocalItem = useCartStore((s) => s.addItem);
  const isPending = isAdding || isUpdating;

  const basePrice = resolvedProduct ? parseFloat(resolvedProduct.price) : 0;
  const hasDiscount = (resolvedProduct?.discountPercent ?? 0) > 0;
  const discountedBase = resolvedProduct?.finalPrice ?? basePrice;

  const optionSurcharge = useMemo(
    () => computeOptionSurcharge(optionGroups, selectedOptions),
    [optionGroups, selectedOptions],
  );

  const toppingTotal = useMemo(
    () => toppings.filter((top) => selectedToppings.has(top.id)).reduce((s, top) => s + top.price, 0),
    [toppings, selectedToppings],
  );

  const unitPrice = discountedBase + optionSurcharge + toppingTotal;
  const totalPrice = unitPrice * quantity;

  function toggleTopping(id: string, isCurrentlyActive: boolean) {
    setSelectedToppings(isCurrentlyActive ? new Set() : new Set([id]));
  }

  function handleSubmit() {
    if (!resolvedProduct) return;

    if (isGroupOrderMode && onGroupConfirm) {
      onGroupConfirm({
        quantity,
        selectedOptions,
        toppings: toppings
          .filter((top) => selectedToppings.has(top.id))
          .map((top) => ({ toppingId: top.id, name: top.name, price: top.price, nameTranslation: top.nameTranslation ?? undefined })),
        note: note.trim() || undefined,
      });
      onClose();
      return;
    }

    if (isEditMode && editItem) {
      updateItem(
        {
          itemId: editItem.id,
          quantity,
          selectedOptions,
          toppingIds: Array.from(selectedToppings),
          toppingSnapshots: toppings
            .filter((top) => selectedToppings.has(top.id))
            .map((top) => ({
              toppingId: top.id,
              topping: { id: top.id, name: top.name, price: String(top.price), nameTranslation: top.nameTranslation ?? {} },
            })),
          note: note || undefined,
        },
        { onSuccess: onClose },
      );
      return;
    }

    const productSnapshot = {
      id: resolvedProduct.id,
      name: resolvedProduct.name,
      nameTranslation: resolvedProduct.nameTranslation ?? undefined,
      slug: resolvedProduct.slug,
      price: resolvedProduct.price,
      finalPrice: resolvedProduct.finalPrice!,
      imageUrls: resolvedProduct.imageUrls,
      discountPercent: resolvedProduct.discountPercent,
      optionGroups: resolvedProduct.optionGroups as any,
      category: {
        name: resolvedProduct.category.name,
        nameTranslation: resolvedProduct.category.nameTranslation ?? undefined,
      },
    };
    const toppingSnapshots = toppings
      .filter((top) => selectedToppings.has(top.id))
      .map((top) => ({
        toppingId: top.id,
        topping: { id: top.id, name: top.name, price: String(top.price), nameTranslation: top.nameTranslation ?? {} },
      }));
    const toppingIds = Array.from(selectedToppings);

    if (!accessToken) {
      addLocalItem({ productId: resolvedProduct.id, quantity, selectedOptions, toppingIds, product: productSnapshot, toppingSnapshots, note });
      setAddedFeedback(true);
      setTimeout(() => { setAddedFeedback(false); onClose(); }, 300);
      return;
    }

    addToCart(
      { productId: resolvedProduct.id, quantity, selectedOptions, toppingIds, product: productSnapshot, toppingSnapshots, note: note || undefined },
      {
        onSuccess: () => {
          setAddedFeedback(true);
          setTimeout(() => { setAddedFeedback(false); onClose(); }, 300);
        },
      },
    );
  }

  const displayName = resolvedProduct ? getDisplayName(resolvedProduct, locale) : "";
  const bgColor = PLACEHOLDER_BG[productIndex % PLACEHOLDER_BG.length];
  const images = resolvedProduct?.imageUrls ?? [];
  const activeImage = images[activeImageIdx] ?? null;
  const isSoldOut = resolvedProduct?.isSoldOut ?? false;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && resolvedProduct && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[9998] bg-black/45 backdrop-blur-[3px]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[9999] mx-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-8px_60px_-8px_rgba(0,0,0,0.22)] md:inset-0 md:m-auto md:max-h-[88vh] md:max-w-[780px] md:rounded-[28px]"
          >
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">

              {/* ── Left: image panel (desktop only) ── */}
              <div className="hidden md:flex md:w-[42%] md:shrink-0 md:flex-col">
                <div
                  className="relative flex-1 overflow-hidden rounded-l-[28px]"
                  style={{ backgroundColor: activeImage ? undefined : bgColor }}
                >
                  {activeImage ? (
                    <Image src={activeImage} alt={displayName} fill className="object-cover" sizes="(min-width: 768px) 350px" quality={88} priority />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="select-none text-7xl font-black text-white/15">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
                  {hasDiscount && !isSoldOut && (
                    <span className="absolute left-4 top-4 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                      -{resolvedProduct.discountPercent}%
                    </span>
                  )}
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="rounded-full border border-white/30 bg-black/60 px-4 py-1.5 text-sm font-semibold tracking-wide text-white">
                        {t("sold_out")}
                      </span>
                    </div>
                  )}
                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button key={i} onClick={() => setActiveImageIdx(i)}
                          className={`h-1.5 rounded-full transition-all ${i === activeImageIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: content panel ── */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

                {/* Mobile image strip */}
                <div
                  className="relative h-48 w-full shrink-0 overflow-hidden md:hidden"
                  style={{ backgroundColor: activeImage ? undefined : bgColor }}
                >
                  {activeImage ? (
                    <Image src={activeImage} alt={displayName} fill className="object-cover" sizes="100vw" quality={85} priority />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="select-none text-6xl font-black text-white/15">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  {hasDiscount && !isSoldOut && (
                    <span className="absolute left-4 top-4 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow">
                      -{resolvedProduct.discountPercent}%
                    </span>
                  )}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button key={i} onClick={() => setActiveImageIdx(i)}
                          className={`h-1.5 rounded-full transition-all ${i === activeImageIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/35 md:bg-white/90 md:text-foreground md:shadow-sm"
                  aria-label={t("close")}
                >
                  <X className="size-4" />
                </button>

                {/* Scrollable body */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5 sm:px-6">

                  {/* Header */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                      {getDisplayName(resolvedProduct.category, locale)}
                    </p>
                    <h2 className="text-base font-semibold leading-snug text-foreground sm:text-xl">
                      {displayName}
                    </h2>
                    {(isEditMode || (isGroupOrderMode && groupInitial)) && (
                      <p className="text-xs font-medium text-muted">{t("edit")}</p>
                    )}
                    <div className="flex items-baseline gap-2.5">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={unitPrice}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          transition={{ duration: 0.16 }}
                          className="text-lg font-black tabular-nums text-kun-products-forest sm:text-xl"
                        >
                          {formatVnd(unitPrice)}
                        </motion.p>
                      </AnimatePresence>
                      {hasDiscount && (
                        <p className="text-xs text-muted line-through sm:text-sm">{formatVnd(basePrice)}</p>
                      )}
                    </div>
                    {getDisplayDescription(resolvedProduct, locale) && (
                      <p className="text-[13px] leading-relaxed text-foreground/60 line-clamp-2">
                        {getDisplayDescription(resolvedProduct, locale)}
                      </p>
                    )}
                  </div>

                  <div className="my-4 h-px bg-black/[0.06]" />

                  {/* Options */}
                  {optionGroups.length > 0 && (
                    <div className="space-y-4">
                      {optionGroups.map((grp) => (
                        <div key={grp.id} className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                            {getDisplayName(grp, locale)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {grp.values.map((v) => {
                              const isSelected = selectedOptions[grp.name] === v.label;
                              return (
                                <button
                                  key={v.label}
                                  type="button"
                                  onClick={() => setSelectedOptions((prev) => ({ ...prev, [grp.name]: v.label }))}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all ${isSelected
                                    ? "border-kun-products-forest bg-kun-products-forest/10 text-kun-products-forest"
                                    : "border-black/10 bg-white text-foreground hover:border-black/20"
                                    }`}
                                >
                                  {getValueLabel(v, locale)}
                                  {v.priceDelta > 0 && (
                                    <span className={`text-xs tabular-nums ${isSelected ? "text-kun-products-forest/70" : "text-muted"}`}>
                                      +{formatVnd(v.priceDelta)}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div className="my-3 h-px bg-black/[0.06]" />
                    </div>
                  )}

                  {/* Toppings — radio style, max 1 */}
                  {toppings.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                          {t("extra_toppings")}
                        </p>
                        {selectedToppings.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedToppings(new Set())}
                            className="text-[11px] font-medium text-muted hover:text-foreground transition-colors"
                          >
                            {t("remove")}
                          </button>
                        )}
                      </div>
                      <div className="max-h-[172px] overflow-y-auto overscroll-contain rounded-xl grid grid-cols-1 gap-1.5">
                        {toppings.map((top) => {
                          const isActive = selectedToppings.has(top.id);
                          return (
                            <button
                              key={top.id}
                              type="button"
                              onClick={() => toggleTopping(top.id, isActive)}
                              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all ${isActive
                                ? "border-kun-products-forest/40 bg-kun-products-forest/8 text-kun-products-forest"
                                : "border-black/[0.07] bg-surface-card/40 text-foreground hover:border-black/15"
                                }`}
                            >
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                                {getDisplayName(top, locale)}
                              </span>
                              <span className={`shrink-0 text-[12px] tabular-nums font-semibold ${isActive ? "text-kun-products-forest" : "text-muted"}`}>
                                +{formatVnd(top.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  <div className="mt-4 space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
                      <StickyNote className="size-3" />
                      {t("note")}
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t("note_placeholder")}
                      className="h-10 w-full rounded-xl border border-black/[0.09] bg-white px-3.5 text-[13px] text-foreground placeholder:text-muted/60 focus:border-kun-primary focus:outline-none focus:ring-2 focus:ring-kun-primary/20"
                    />
                  </div>
                </div>

                {/* Sticky footer */}
                <div className="shrink-0 border-t border-black/[0.06] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center rounded-full border border-black/[0.09] bg-surface-card/40">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.05] disabled:opacity-35"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.05]"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-muted">{t("total")}</p>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={totalPrice}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          transition={{ duration: 0.15 }}
                          className="text-lg font-black tabular-nums text-kun-products-forest"
                        >
                          {formatVnd(totalPrice)}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    type="button"
                    disabled={isSoldOut || isPending}
                    onClick={handleSubmit}
                    className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold shadow-lg transition-all disabled:opacity-60 ${addedFeedback
                      ? "bg-emerald-600 text-white shadow-emerald-200"
                      : "bg-kun-products-forest text-white hover:opacity-90 shadow-kun-products-forest/25"
                      }`}
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isGroupOrderMode ? (
                      <>
                        <Check className="size-4" />
                        {groupInitial ? t("group_update_item_btn") : t("group_add_item_btn")}
                      </>
                    ) : addedFeedback ? (
                      <>
                        <Check className="size-4" />
                        {t("added_to_cart")}
                      </>
                    ) : isEditMode ? (
                      <>
                        <Check className="size-4" />
                        {t("save_changes")}
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="size-4" />
                        {isSoldOut ? t("sold_out") : t("add_to_cart")}
                      </>
                    )}
                  </button>

                  {/* View detail link — only in regular add mode */}
                  {!isEditMode && !isGroupOrderMode && (
                    <Link
                      href={`${ROUTES.MENU}/${resolvedProduct.slug}`}
                      onClick={onClose}
                      className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-kun-products-forest"
                    >
                      {t("see_all")}
                      <ArrowRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
