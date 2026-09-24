"use client";

import { create } from "zustand";
import type { ApiCartItem } from "@/services/cart/types";

type ReorderState = {
  items: ApiCartItem[] | null;
  setItems: (items: ApiCartItem[]) => void;
  clear: () => void;
};

export const useReorderStore = create<ReorderState>((set) => ({
  items: null,
  setItems: (items) => set({ items }),
  clear: () => set({ items: null }),
}));