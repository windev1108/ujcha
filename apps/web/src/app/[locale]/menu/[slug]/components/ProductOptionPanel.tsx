"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import { ShoppingCart, Check, Loader2, Minus, Plus, StickyNote } from "lucide-react";
import { Button, Checkbox } from "@heroui/react";
import { useAddToCartMutation } from "@/services/cart/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import type { ApiProduct } from "@/services/product/types";
import {
  normalizeOptionGroups,
  computeOptionSurcharge,
  formatVnd,
} from "@/lib/product-options";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayName, getValueLabel, getDisplayDescription } from "@/lib/product-name";


type Props = { product: ApiProduct };

export function ProductOptionPanel({ product }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const accessToken = useAuthStore((s) => s.accessToken);
  const toppings = (product.toppings ?? []).filter((t) => t.isActive !== false);

  const optionGroups = useMemo(
    () => normalizeOptionGroups(product.optionGroups),
    [product.optionGroups],
  );

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const g of optionGroups) {
      const free = g.values.find((v) => v.priceDelta === 0) ?? g.values[0];
      if (free) init[g.name] = free.label;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedOptions(init);
  }, [optionGroups]);

  const { mutate: addToCart, isPending } = useAddToCartMutation();
  const addLocalItem = useCartStore((s) => s.addItem);

  const basePrice = parseFloat(product.price);
  const hasProductDiscount = product.discountPercent > 0;
  const discountedBase = product.finalPrice;

  const optionSurcharge = useMemo(
    () => computeOptionSurcharge(optionGroups, selectedOptions),
    [optionGroups, selectedOptions],
  );

  const toppingTotal = useMemo(
    () =>
      toppings
        .filter((t) => selectedToppings.has(t.id))
        .reduce((s, t) => s + t.price, 0),
    [toppings, selectedToppings],
  );

  const unitPrice = discountedBase + optionSurcharge + toppingTotal;
  const totalPrice = unitPrice * quantity;

  function toggleTopping(id: string, checked: boolean) {
    setSelectedToppings(checked ? new Set([id]) : new Set());
  }

  function handleAddToCart() {
    const selectedToppingIds = Array.from(selectedToppings);
    const productSnapshot = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      finalPrice: product.finalPrice,
      imageUrls: product.imageUrls,
      discountPercent: product.discountPercent,
      optionGroups: product.optionGroups as any,
      category: { name: product.category.name },
    };
    const toppingSnapshots = toppings
      .filter((t) => selectedToppings.has(t.id))
      .map((t) => ({ toppingId: t.id, topping: { id: t.id, name: t.name, price: String(t.price), nameTranslation: t.nameTranslation ?? {} } }));

    if (!accessToken) {
      addLocalItem({ productId: product.id, quantity, selectedOptions, toppingIds: selectedToppingIds, product: productSnapshot, toppingSnapshots });
      setAddedFeedback(true);
      setTimeout(() => setAddedFeedback(false), 2200);
      return;
    }

    addToCart(
      { productId: product.id, quantity, selectedOptions, toppingIds: selectedToppingIds, product: productSnapshot, toppingSnapshots },
      {
        onSuccess: () => {
          setAddedFeedback(true);
          setTimeout(() => setAddedFeedback(false), 2200);
        },
      },
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...revealTransition, delay: 0.08 }}
      className="flex flex-col gap-7 rounded-3xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-sm shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] sm:p-8"
    >
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {getDisplayName(product.category, locale)}
          </span>
          {product.isSoldOut && (
            <span className="rounded-full bg-black/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              {t("sold_out")}
            </span>
          )}
          {hasProductDiscount && !product.isSoldOut && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">
              -{product.discountPercent}%
            </span>
          )}
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          {getDisplayName(product, locale)}
        </h1>

        {/* Price row */}
        <div className="flex items-baseline gap-3">
          <AnimatePresence mode="wait">
            <motion.p
              key={discountedBase}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="text-3xl font-black tabular-nums text-kun-products-forest"
            >
              {formatVnd(discountedBase)}
            </motion.p>
          </AnimatePresence>
          {hasProductDiscount && (
            <p className="text-lg text-muted line-through">{formatVnd(basePrice)}</p>
          )}
        </div>

        {getDisplayDescription(product, locale) && (
          <p className="text-sm leading-relaxed text-foreground/65 sm:text-[15px]">
            {getDisplayDescription(product, locale)}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-black/[0.06]" />

      {/* Options + Toppings — side by side */}
      {(optionGroups.length > 0 || toppings.length > 0) && (
        <div className="grid gap-5 sm:grid-cols-2">

          {/* Option groups */}
          {optionGroups.length > 0 && (
            <div className="space-y-5">
              {optionGroups.map((grp) => (
                <div key={grp.id} className="space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {getDisplayName(grp, locale)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grp.values.map((v) => {
                      const isSelected = selectedOptions[grp.name] === v.label;
                      return (
                        <button
                          key={v.label}
                          type="button"
                          onClick={() =>
                            setSelectedOptions((prev) => ({ ...prev, [grp.name]: v.label }))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${isSelected
                            ? "border-kun-products-forest bg-kun-products-forest/10 text-kun-products-forest shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
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
            </div>
          )}

          {/* Toppings */}
          {toppings.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {t("extra_toppings")}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/50">{t("topping_desc")}</p>
                </div>
                {selectedToppings.size > 0 && (
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-kun-products-forest">
                    {t("selected")}
                  </span>
                )}
              </div>
              <div
                className="max-h-[220px] space-y-1.5 overflow-y-auto scroll-smooth rounded-2xl border border-black/[0.07] bg-surface-secondary/40 p-2 pr-1"
                role="listbox"
                aria-label="Danh sách topping"
                aria-multiselectable="false"
              >
                {toppings.map((top) => {
                  const isActive = selectedToppings.has(top.id);
                  return (
                    <label
                      key={top.id}
                      role="option"
                      aria-selected={isActive}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all cursor-pointer ${isActive
                        ? "border-kun-products-forest/35 bg-kun-mint/15"
                        : "border-transparent bg-white hover:border-black/8"
                        }`}
                    >
                      <Checkbox
                        isSelected={isActive}
                        onChange={(v) => toggleTopping(top.id, v)}
                        aria-label={getDisplayName(top, locale)}
                      />
                      <span className={`min-w-0 flex-1 text-sm font-medium ${isActive ? "text-kun-products-forest" : "text-foreground"}`}>
                        {getDisplayName(top, locale)}
                      </span>
                      <span className={`shrink-0 text-xs tabular-nums ${isActive ? "font-bold text-kun-products-forest" : "text-foreground/55"}`}>
                        +{formatVnd(top.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Note */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
          <StickyNote className="size-3" />
          {t("note")}
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("note_placeholder")}
          className="h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3.5 text-sm text-foreground placeholder:text-muted/60 focus:border-kun-primary focus:outline-none focus:ring-2 focus:ring-kun-primary/20"
        />
      </div>

      {/* Quantity + price */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-secondary/60 px-4 py-3.5">
        <div className="flex items-center gap-0 rounded-full border border-black/[0.09] bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.04] disabled:opacity-35"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-10 text-center text-sm font-bold tabular-nums">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.04]"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-medium text-muted">{t("total")}</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={totalPrice}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="text-xl font-black tabular-nums text-kun-products-forest"
            >
              {formatVnd(totalPrice)}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        isDisabled={product.isSoldOut || isPending}
        onPress={handleAddToCart}
        className={`h-14 w-full rounded-full text-[15px] font-semibold shadow-lg transition-all ${addedFeedback
          ? "bg-emerald-600 text-white shadow-emerald-200"
          : "bg-kun-products-forest text-white hover:opacity-90 shadow-kun-products-forest/20"
          }`}
      >
        {isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : addedFeedback ? (
          <>
            <Check className="mr-2 size-5" />
            {t("added_to_cart")}
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 size-5" />
            {product.isSoldOut ? t("sold_out") : t("add_to_cart")}
          </>
        )}
      </Button>

    </motion.div>
  );
}
