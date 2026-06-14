import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandAsyncStorage } from '@/lib/storage'
import { itemKey } from '@/lib/product-options'
import type { ApiCartItem, ApiCartProduct, ApiCartTopping } from '@/types'

interface AddItemInput {
  productId: string
  quantity: number
  selectedOptions: Record<string, string>
  toppingIds: string[]
  product: ApiCartProduct
  toppingSnapshots: ApiCartTopping[]
  note?: string
}

interface CartState {
  items: ApiCartItem[]
  addItem: (input: AddItemInput) => void
  updateItem: (itemId: string, quantity: number) => void
  removeItem: (itemId: string) => void
  removeItems: (itemIds: string[]) => void
  clearCart: () => void
}

function generateId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: ({ productId, quantity, selectedOptions, toppingIds, product, toppingSnapshots, note }) =>
        set((s) => {
          const key = itemKey(productId, selectedOptions, toppingIds)
          const existing = s.items.find(
            (it) => itemKey(it.productId, it.selectedOptions, it.toppings.map((t) => t.toppingId)) === key,
          )
          if (existing) {
            return {
              items: s.items.map((it) =>
                it.id === existing.id ? { ...it, quantity: it.quantity + quantity } : it,
              ),
            }
          }
          const newItem: ApiCartItem = {
            id: generateId(),
            cartId: 'local',
            productId,
            quantity,
            selectedOptions,
            toppings: toppingSnapshots,
            product,
            ...(note ? { note } : {}),
          } as ApiCartItem
          return { items: [...s.items, newItem] }
        }),

      updateItem: (itemId, quantity) =>
        set((s) => ({
          items: quantity <= 0
            ? s.items.filter((it) => it.id !== itemId)
            : s.items.map((it) => (it.id === itemId ? { ...it, quantity } : it)),
        })),

      removeItem: (itemId) =>
        set((s) => ({ items: s.items.filter((it) => it.id !== itemId) })),

      removeItems: (itemIds) =>
        set((s) => ({ items: s.items.filter((it) => !itemIds.includes(it.id)) })),

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'ujcha-cart',
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
)

export function useCartItemCount(): number {
  return useCartStore((s) => s.items.reduce((n, it) => n + it.quantity, 0))
}
