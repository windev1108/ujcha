"use client";

import { Button, Checkbox } from "@heroui/react";
import { motion } from "motion/react";
import { Minus, Plus, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { easeOutSmooth, revealTransition } from "@/app/[locale]/(landing)/components/RevealSection";
import type { ApiCartItem } from "@/services/cart/types";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { normalizeOptionGroups, computeOptionSurcharge } from "@/lib/product-options";
import { ItemOptionsDisplay } from "@/components/cart/ItemOptionsDisplay";
import { useTranslations, useLocale } from "next-intl";
import { getDisplayName } from "@/lib/product-name";


type Props = {
  items: ApiCartItem[];
  selectedIds: Set<string>;
  onToggleSelect: (itemId: string) => void;
  onToggleAll: () => void;
  isAllSelected: boolean;
  onQuantityChange: (itemId: string, next: number) => void;
  onRemove: (itemId: string) => void;
  onEdit: (item: ApiCartItem) => void;
  isUpdating?: boolean;
};

const PLACEHOLDER_BG = ["#1a3c34", "#2d1a0a", "#0d2035", "#1a0d2e", "#1a2e0d"] as const;

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOutSmooth } },
};

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

export function CartLineList({
  items,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  isAllSelected,
  onQuantityChange,
  onRemove,
  onEdit,
  isUpdating,
}: Props) {
  const selectedCount = selectedIds.size;
  const isIndeterminate = selectedCount > 0 && selectedCount < items.length;
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div className="min-w-0 flex-1">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={revealTransition}
        className="mb-6 sm:mb-8"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t('your_cart')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground/70 sm:text-base">
          {items.length} {items.length > 1 ? t('products') : t('products').slice(0, -1)}
          {selectedCount < items.length && selectedCount > 0 && (
            <span className="ml-1.5 font-medium text-kun-primary">· {t("selected")} {selectedCount}</span>
          )}
        </p>
      </motion.div>

      {/* Select-all bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...revealTransition, delay: 0.04 }}
        className="mb-3 flex items-center gap-3 rounded-2xl border border-black/6 bg-white px-4 py-3"
      >
        <Checkbox
          isSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onChange={onToggleAll}
          variant="primary"
          aria-label={t("select_all")}
        >
          <Checkbox.Control className="size-6 rounded-lg border-2 border-black/25">
            <Checkbox.Indicator className="size-4" />
          </Checkbox.Control>
          <Checkbox.Content>
            <span className="text-sm font-medium text-foreground">
              {t("select_all")}
              <span className="ml-1 text-foreground/50">({items.length})</span>
            </span>
          </Checkbox.Content>
        </Checkbox>
      </motion.div>

      {/* Item list */}
      <motion.ul
        className="space-y-0"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {items.map(({ id, product, quantity, selectedOptions, toppings }, index) => {
          const productDisplayName = getDisplayName(product, locale);
          const imageUrl = product.imageUrls[0] ?? null;
          const bgColor = PLACEHOLDER_BG[index % PLACEHOLDER_BG.length];
          const basePrice = parseFloat(product.price);
          const discountedBase = product.finalPrice;
          const groups = normalizeOptionGroups(product.optionGroups);
          const optionSurcharge = computeOptionSurcharge(groups, selectedOptions);
          const toppingTotal = (toppings ?? []).reduce(
            (sum, t) => sum + parseFloat(t.topping.price),
            0,
          );
          const unitPrice = discountedBase + optionSurcharge + toppingTotal;
          const lineTotal = unitPrice * quantity;


          const isSelected = selectedIds.has(id);

          return (
            <motion.li
              key={id}
              layout
              variants={rowVariants}
              className={`border-b border-black/6 py-5 last:border-b-0 transition-colors sm:py-6 ${isSelected ? "bg-transparent" : "opacity-60"
                }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Checkbox */}
                <div className="pt-[18px] sm:pt-5 shrink-0">
                  <Checkbox
                    isSelected={isSelected}
                    onChange={() => onToggleSelect(id)}
                    variant="primary"
                    aria-label={`${t("selected")} ${productDisplayName}`}
                  >
                    <Checkbox.Control className="size-6 rounded-lg border-2 border-black/25">
                      <Checkbox.Indicator className="size-4" />
                    </Checkbox.Control>
                  </Checkbox>
                </div>

                {/* Content */}
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                  {/* Image */}
                  <Link
                    href={`${ROUTES.PRODUCTS}/${product.slug}`}
                    className="mx-auto shrink-0 sm:mx-0"
                  >
                    <div
                      className="relative size-24 overflow-hidden rounded-2xl ring-1 ring-black/6 sm:size-28"
                      style={{ backgroundColor: imageUrl ? undefined : bgColor }}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={productDisplayName}
                          fill
                          className="object-cover"
                          sizes="112px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-black text-white/20 select-none">
                            {productDisplayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                          {getDisplayName(product.category, locale)}
                        </p>
                        <Link href={`${ROUTES.PRODUCTS}/${product.slug}`}>
                          <h2 className="mt-0.5 text-base font-semibold text-foreground hover:text-kun-primary transition-colors sm:text-lg">
                            {productDisplayName}
                          </h2>
                        </Link>

                        <ItemOptionsDisplay
                          item={{ product, selectedOptions, toppings }}
                        />

                        {/* Actions */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1 rounded-full border border-black/8 bg-white/80 px-1 py-1 ring-1 ring-black/4">
                            <Button
                              isIconOnly
                              variant="ghost"
                              size="sm"
                              aria-label={t("decrease_qty")}
                              isDisabled={isUpdating || quantity <= 1}
                              className="size-7 min-w-7 rounded-full"
                              onPress={() => onQuantityChange(id, quantity - 1)}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="min-w-[1.75rem] text-center text-sm font-medium tabular-nums">
                              {quantity}
                            </span>
                            <Button
                              isIconOnly
                              variant="ghost"
                              size="sm"
                              aria-label={t("increase_qty")}
                              isDisabled={isUpdating}
                              className="size-7 min-w-7 rounded-full"
                              onPress={() => onQuantityChange(id, quantity + 1)}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={isUpdating}
                            className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium text-muted hover:text-foreground"
                            onPress={() => onEdit({ id, product, quantity, selectedOptions, toppings } as ApiCartItem)}
                          >
                            <Pencil className="size-3" />
                            {t("edit")}
                          </Button>

                          <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t("remove")}
                            isDisabled={isUpdating}
                            className="size-8 min-w-8 rounded-full text-muted hover:text-red-500"
                            onPress={() => onRemove(id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="shrink-0 text-right">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
                            -{product.discountPercent}%
                          </span>
                          <p className="text-lg font-bold tabular-nums text-kun-products-forest sm:text-xl">
                            {formatVnd(lineTotal)}
                          </p>
                        </div>
                        {quantity > 1 && (
                          <p className="text-xs text-muted mt-0.5">
                            {formatVnd(unitPrice)} × {quantity}
                          </p>
                        )}
                        {product.discountPercent > 0 && (
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                            <p className="text-xs text-muted line-through tabular-nums">
                              {formatVnd(parseFloat(product.price) * quantity)}
                            </p>

                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
