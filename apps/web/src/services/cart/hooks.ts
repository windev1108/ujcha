"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  removeCartItems,
} from "./api";
import { useAuthStore } from "@/store/auth-store";
import type { ApiCartProduct, ApiCartTopping } from "./types";

export const cartKeys = {
  cart: ["cart"] as const,
};

export function useCartQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: cartKeys.cart,
    queryFn: fetchCart,
    enabled: !!accessToken,
    staleTime: 30_000,
  });
}

export function useAddToCartMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      selectedOptions,
      toppingIds,
    }: {
      productId: string;
      quantity?: number;
      selectedOptions?: Record<string, string>;
      toppingIds?: string[];
      product?: ApiCartProduct;
      toppingSnapshots?: ApiCartTopping[];
    }) => {
      await addToCart(productId, quantity ?? 1, selectedOptions, toppingIds);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKeys.cart }),
  });
}

export function useUpdateCartItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
      selectedOptions,
      toppingIds,
    }: {
      itemId: string;
      quantity: number;
      selectedOptions?: Record<string, string>;
      toppingIds?: string[];
      toppingSnapshots?: ApiCartTopping[];
    }) => {
      await updateCartItem(itemId, quantity, selectedOptions, toppingIds);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKeys.cart }),
  });
}

export function useRemoveCartItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => removeCartItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKeys.cart }),
  });
}

export function useRemoveCartItemsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemIds: string[]) => removeCartItems(itemIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: cartKeys.cart }),
  });
}
