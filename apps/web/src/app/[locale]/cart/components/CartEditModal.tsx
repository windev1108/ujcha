"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Loader2, Minus, Plus } from "lucide-react";
import { Button, Checkbox, ListBox, Select } from "@heroui/react";
import { useToppingsQuery } from "@/services/topping/hooks";
import { useUpdateCartItemMutation } from "@/services/cart/hooks";
import type { ApiCartItem } from "@/services/cart/types";
import {
  normalizeOptionGroups,
  computeOptionSurcharge,
  formatVnd,
} from "@/lib/product-options";

type Props = {
  item: ApiCartItem | null;
  onClose: () => void;
};

export function CartEditModal({ item, onClose }: Props) {
  const { data: toppings = [] } = useToppingsQuery();
  const { mutate: updateItem, isPending } = useUpdateCartItemMutation();

  const optionGroups = useMemo(
    () => (item ? normalizeOptionGroups(item.product.optionGroups) : []),
    [item],
  );

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!item) return;
    setQuantity(item.quantity);
    setSelectedToppings(new Set(item.toppings.map((t) => t.toppingId)));

    // Pre-fill options: try group name key first, then group id key (legacy)
    const opts: Record<string, string> = {};
    for (const grp of optionGroups) {
      opts[grp.name] =
        item.selectedOptions[grp.name] ??
        item.selectedOptions[grp.id] ??
        grp.values[0]?.label ??
        "";
    }
    setSelectedOptions(opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  function toggleTopping(id: string, checked: boolean) {
    setSelectedToppings((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  const basePrice = item ? parseFloat(item.product.price) : 0;
  const discountedBase = item?.product.discountPercent
    ? basePrice * (1 - item.product.discountPercent / 100)
    : basePrice;

  const optionSurcharge = useMemo(
    () => computeOptionSurcharge(optionGroups, selectedOptions),
    [optionGroups, selectedOptions],
  );

  const toppingTotal = useMemo(
    () =>
      toppings
        .filter((t) => selectedToppings.has(t.id))
        .reduce((s, t) => s + parseFloat(t.price), 0),
    [toppings, selectedToppings],
  );

  const unitPrice = discountedBase + optionSurcharge + toppingTotal;

  function handleSave() {
    if (!item) return;
    updateItem(
      {
        itemId: item.id,
        quantity,
        selectedOptions,
        toppingIds: Array.from(selectedToppings),
        toppingSnapshots: toppings
          .filter((t) => selectedToppings.has(t.id))
          .map((t) => ({ toppingId: t.id, topping: { id: t.id, name: t.name, price: t.price } })),
      },
      { onSuccess: onClose },
    );
  }

  const open = !!item;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet / dialog */}
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-3xl bg-white pb-8 shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[92vh] sm:overflow-y-auto sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/[0.07] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Chỉnh sửa</h2>
                {item && (
                  <p className="mt-0.5 text-xs text-muted line-clamp-1">{item.product.name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-black/[0.06] transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {/* Option groups */}
              {optionGroups.length > 0 && (
                <div className="space-y-4 rounded-2xl border border-black/[0.07] bg-surface-secondary/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    Tuỳ chọn
                  </p>
                  {optionGroups.map((grp) => (
                    <div key={grp.id} className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">
                        {grp.name}
                      </label>
                      <Select
                        className="w-full"
                        value={selectedOptions[grp.name] ?? ""}
                        onChange={(key) => {
                          if (key == null) return;
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [grp.name]: String(key),
                          }));
                        }}
                      >
                        <Select.Trigger className="h-11 w-full rounded-xl border border-black/[0.09] bg-white px-3 text-sm shadow-none hover:border-kun-primary/40 focus:border-kun-primary focus:ring-2 focus:ring-kun-primary/20">
                          <Select.Value className="text-sm text-foreground" />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover placement="bottom start">
                          <ListBox className="min-w-(--trigger-width) rounded-xl border border-black/[0.08] bg-white p-1 shadow-lg outline-none">
                            {grp.values.map((v) => (
                              <ListBox.Item
                                key={v.label}
                                id={v.label}
                                textValue={v.label}
                                className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-surface-secondary"
                              >
                                <span>{v.label}</span>
                                {v.priceDelta > 0 && (
                                  <span className="ml-3 shrink-0 text-xs tabular-nums text-muted">
                                    +{formatVnd(v.priceDelta)}
                                  </span>
                                )}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {/* Toppings */}
              {toppings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    Topping
                  </p>
                  <div
                    className="max-h-[min(40vh,240px)] space-y-1.5 overflow-y-auto scroll-smooth rounded-2xl border border-black/[0.07] bg-surface-secondary/40 p-2 pr-1.5"
                    role="listbox"
                    aria-multiselectable="true"
                  >
                    {toppings.map((top) => {
                      const isActive = selectedToppings.has(top.id);
                      return (
                        <label
                          key={top.id}
                          role="option"
                          aria-selected={isActive}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                            isActive
                              ? "border-kun-products-forest/40 bg-kun-mint/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                              : "border-transparent bg-white hover:border-black/10"
                          }`}
                        >
                          <Checkbox
                            isSelected={isActive}
                            onChange={(v) => toggleTopping(top.id, v)}
                            aria-label={top.name}
                          />
                          <span
                            className={`min-w-0 flex-1 text-sm font-medium ${
                              isActive ? "text-kun-products-forest" : "text-foreground"
                            }`}
                          >
                            {top.name}
                          </span>
                          <span
                            className={`shrink-0 text-sm tabular-nums ${
                              isActive
                                ? "font-semibold text-kun-products-forest"
                                : "text-foreground/60"
                            }`}
                          >
                            +{formatVnd(top.price)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedToppings.size > 0 && (
                    <p className="text-xs text-foreground/50">
                      Đã chọn{" "}
                      <span className="font-semibold text-kun-products-forest">
                        {selectedToppings.size}
                      </span>{" "}
                      topping
                    </p>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Số lượng
                </p>
                <div className="inline-flex items-center rounded-full border border-black/[0.08] bg-surface-secondary">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.04] disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-black/[0.04]"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </div>

              {/* Live price */}
              <div className="flex items-center justify-between rounded-2xl bg-kun-products-forest/8 px-4 py-3">
                <span className="text-sm font-semibold text-kun-products-forest">
                  Đơn giá
                </span>
                <span className="text-xl font-bold tabular-nums text-kun-products-forest">
                  {formatVnd(unitPrice)}
                </span>
              </div>

              {/* Save */}
              <Button
                size="lg"
                isDisabled={isPending}
                onPress={handleSave}
                className="h-13 w-full rounded-full bg-kun-products-forest text-base font-semibold text-white hover:opacity-90"
              >
                {isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-1 size-5" />
                    Lưu thay đổi
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
