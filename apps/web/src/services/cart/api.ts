import { api } from '@/config/server'
import type { ApiCart } from './types'

export async function fetchCart(): Promise<ApiCart | null> {
  const { data } = await api.get<ApiCart | null>('/cart')
  return data
}

export async function addToCart(
  productId: string,
  quantity: number,
  selectedOptions?: Record<string, string>,
  toppingIds?: string[],
): Promise<void> {
  await api.post('/cart/items', { productId, quantity, selectedOptions, toppingIds })
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
  selectedOptions?: Record<string, string>,
  toppingIds?: string[],
): Promise<void> {
  await api.patch(`/cart/items/${itemId}`, { quantity, selectedOptions, toppingIds })
}

export async function removeCartItem(itemId: string): Promise<void> {
  await api.delete(`/cart/items/${itemId}`)
}

export async function removeCartItems(itemIds: string[]): Promise<void> {
  await api.delete('/cart/items', { data: { itemIds } })
}
