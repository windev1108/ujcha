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
};

export const useCartStore = create<CartStoreState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: "kun-cart",
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
