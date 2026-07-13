"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ApiCartItem, ApiCartProduct, ApiCartTopping } from "@/services/cart/types";

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function itemKey(productId: string, selectedOptions: Record<string, string>, toppingIds: string[], note: string) {
  return (
    productId +
    "||" +
    JSON.stringify(selectedOptions) +
    "||" +
    [...toppingIds].sort().join(",") +
    "||" +
    note.trim()
  );
}

function consolidate(items: ApiCartItem[]): ApiCartItem[] {
  const map = new Map<string, ApiCartItem>();
  for (const item of items) {
    const key = itemKey(
      item.productId,
      item.selectedOptions,
      (item.toppings ?? []).map((t) => t.toppingId),
      item.note ?? "",
    );
    const existing = map.get(key);
    if (existing) {
      map.set(key, { ...existing, quantity: existing.quantity + item.quantity });
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

type AddItemInput = {
  productId: string;
  quantity: number;
  selectedOptions: Record<string, string>;
  toppingIds: string[];
  product: ApiCartProduct;
  toppingSnapshots: ApiCartTopping[];
  note?: string;
};

type UpdateItemInput = {
  itemId: string;
  quantity: number;
  selectedOptions?: Record<string, string>;
  toppingSnapshots?: ApiCartTopping[];
  note?: string;
};

type CartStoreState = {
  items: ApiCartItem[];
  addItem: (input: AddItemInput) => void;
  updateItem: (input: UpdateItemInput) => void;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  clearCart: () => void;
  /**
   * Re-syncs stale `product`/`toppings` snapshots against fresh data
   * (e.g. after an admin changes price/discount). Items whose product
   * no longer exists (value is `null` in `updates`) are removed from
   * the cart. Returns the display names of any removed items so the
   * caller can surface a toast.
   */
  syncProducts: (updates: Record<string, ApiCartProduct | null>) => string[];
};

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: ({ productId, quantity, selectedOptions, toppingIds, product, toppingSnapshots, note }) =>
        set((s) => {
          const normalizedNote = (note ?? "").trim();
          const key = itemKey(productId, selectedOptions, toppingIds, normalizedNote);
          const existing = s.items.find(
            (item) =>
              itemKey(item.productId, item.selectedOptions, (item.toppings ?? []).map((t) => t.toppingId), item.note ?? "") === key,
          );
          if (existing) {
            return {
              items: s.items.map((item) =>
                item.id === existing.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              ),
            };
          }
          return {
            items: [
              ...s.items,
              {
                id: genId(),
                cartId: "",
                productId,
                quantity,
                selectedOptions,
                product,
                toppings: toppingSnapshots,
                note: normalizedNote || undefined,
              },
            ],
          };
        }),

      updateItem: ({ itemId, quantity, selectedOptions, toppingSnapshots, note }) =>
        set((s) => ({
          items: s.items.map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              quantity,
              ...(selectedOptions !== undefined && { selectedOptions }),
              ...(toppingSnapshots !== undefined && { toppings: toppingSnapshots }),
              ...(note !== undefined && { note: note.trim() || undefined }),
            };
          }),
        })),

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((item) => item.id !== id) })),

      removeItems: (ids) => {
        const idSet = new Set(ids);
        set((s) => ({ items: s.items.filter((item) => !idSet.has(item.id)) }));
      },

      clearCart: () => set({ items: [] }),

      syncProducts: (updates) => {
        const removedNames: string[] = [];
        const current = get().items;
        const nextItems: ApiCartItem[] = [];

        for (const item of current) {
          if (!(item.productId in updates)) {
            // No fresh data fetched for this product (e.g. query still
            // pending or failed outright) — keep the existing snapshot
            // rather than dropping the item.
            nextItems.push(item);
            continue;
          }

          const fresh = updates[item.productId];
          if (!fresh) {
            removedNames.push(item.product?.name ?? item.productId);
            continue;
          }

          const freshToppingsById = new Map((fresh.toppings ?? []).map((tp) => [tp.id, tp]));
          const syncedToppings = (item.toppings ?? []).map((t) => {
            const freshTopping = freshToppingsById.get(t.toppingId);
            if (!freshTopping) return t;
            return {
              ...t,
              topping: {
                ...t.topping,
                price: String(freshTopping.price),
                name: freshTopping.name,
                nameTranslation: freshTopping.nameTranslation,
              },
            };
          });

          nextItems.push({ ...item, product: fresh, toppings: syncedToppings });
        }

        if (removedNames.length > 0 || nextItems.length !== current.length || nextItems.some((it, i) => it !== current[i])) {
          set({ items: nextItems });
        }

        return removedNames;
      },
    }),
    {
      name: "ujcha-cart",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Drop legacy items without product snapshot, then merge duplicates
          const valid = state.items.filter((i) => i.product != null);
          state.items = consolidate(valid);
        }
      },
    },
  ),
);