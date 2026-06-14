import { api } from '@/services/api'
import type { ApiCart } from '@/types'

export async function fetchCart(): Promise<ApiCart> {
  const res = await api.get<ApiCart>('/cart')
  return res.data
}

export async function addToCartApi(payload: {
  productId: string
  quantity: number
  selectedOptions: Record<string, string>
  toppingIds: string[]
  note?: string
}): Promise<ApiCart> {
  const res = await api.post<ApiCart>('/cart/items', payload)
  return res.data
}

export async function updateCartItemApi(
  itemId: string,
  payload: { quantity: number; selectedOptions?: Record<string, string> },
): Promise<ApiCart> {
  const res = await api.patch<ApiCart>(`/cart/items/${itemId}`, payload)
  return res.data
}

export async function removeCartItemApi(itemId: string): Promise<void> {
  await api.delete(`/cart/items/${itemId}`)
}

export async function removeCartItemsApi(itemIds: string[]): Promise<void> {
  await api.delete('/cart/items', { data: { itemIds } })
}
