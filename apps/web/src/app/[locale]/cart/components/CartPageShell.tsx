"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartLineList } from "./CartLineList";
import { CartEditModal } from "./CartEditModal";
import { EmptyCart } from "./EmptyCart";
import { OrderSummary } from "./OrderSummary";
import {
  useCartQuery,
  useUpdateCartItemMutation,
  useRemoveCartItemMutation,
} from "@/services/cart/hooks";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import type { ApiCartItem } from "@/services/cart/types";
import { normalizeOptionGroups, computeOptionSurcharge } from "@/lib/product-options";

function CartSkeleton() {
  return (
    <div className="min-h-screen bg-surface-soft pb-16 pt-8 sm:pb-20 sm:pt-10">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="min-w-0 flex-1 space-y-8">
            <div className="h-10 w-52 animate-pulse rounded-lg bg-surface-secondary" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-5 border-b border-black/6 pb-6">
                <div className="size-28 shrink-0 animate-pulse rounded-2xl bg-surface-secondary" />
                <div className="flex-1 space-y-3 pt-1">
                  <div className="h-3 w-1/4 animate-pulse rounded bg-surface-secondary" />
                  <div className="h-6 w-1/2 animate-pulse rounded-lg bg-surface-secondary" />
                  <div className="h-9 w-32 animate-pulse rounded-full bg-surface-secondary" />
                </div>
              </div>
            ))}
          </div>
          <div className="w-full shrink-0 lg:max-w-md">
            <div className="h-72 animate-pulse rounded-3xl bg-surface-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CartPageShell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isGuest = !accessToken;

  // Server cart (members only)
  const { data: serverCart, isLoading: serverCartLoading } = useCartQuery();
  const updateServerItem = useUpdateCartItemMutation();
  const removeServerItem = useRemoveCartItemMutation();

  // Local cart (guests) — always available from Zustand persist
  const localItems = useCartStore((s) => s.items);
  const updateLocalItem = useCartStore((s) => s.updateItem);
  const removeLocalItem = useCartStore((s) => s.removeItem);

  const [editingItem, setEditingItem] = useState<ApiCartItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const items = isGuest ? localItems : (serverCart?.items ?? []);
  const isLoading = isGuest ? false : serverCartLoading;

  useEffect(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleSelect = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  }, [isAllSelected, items]);

  const subtotal = useMemo(
    () =>
      items
        .filter((item) => selectedIds.has(item.id))
        .reduce((sum, item) => {
          const discountedBase = Number(item.product.finalPrice) || Number(item.product.price) || 0;
          const groups = normalizeOptionGroups(item.product.optionGroups);
          const optionSurcharge = computeOptionSurcharge(groups, item.selectedOptions);
          const toppingTotal = (item.toppings ?? []).reduce(
            (s, t) => s + Number(t.topping?.price ?? 0),
            0,
          );
          return sum + (discountedBase + optionSurcharge + toppingTotal) * item.quantity;
        }, 0),
    [items, selectedIds],
  );

  function handleQuantityChange(itemId: string, next: number) {
    if (next < 1) return;
    if (isGuest) {
      updateLocalItem({ itemId, quantity: next });
    } else {
      updateServerItem.mutate({ itemId, quantity: next });
    }
  }

  function handleRemove(itemId: string) {
    if (isGuest) {
      removeLocalItem(itemId);
    } else {
      removeServerItem.mutate(itemId);
    }
  }

  if (isLoading) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] bg-surface-soft">
        <div className="container mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-surface-soft pb-16 pt-8 sm:pb-20 sm:pt-10">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            layout
            className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12 xl:gap-16"
          >
            <CartLineList
              items={items}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              isAllSelected={isAllSelected}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemove}
              onEdit={setEditingItem}
              isUpdating={
                isGuest
                  ? false
                  : updateServerItem.isPending || removeServerItem.isPending
              }
            />
            <OrderSummary
              subtotal={subtotal}
              total={subtotal}
              selectedCount={selectedIds.size}
              selectedIds={selectedIds}
            />
          </motion.div>
        </div>
      </div>

      <CartEditModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
      />
    </>
  );
}
