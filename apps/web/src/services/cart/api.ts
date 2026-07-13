import { api } from '@/config/server'
import type { ApiCart, ApiCartProduct } from './types'

export async function fetchCart(): Promise<ApiCart | null> {
  const { data } = await api.get<ApiCart | null>('/cart')
  return data
}

export async function addToCart(
  productId: string,
  quantity: number,
  selectedOptions?: Record<string, string>,
  toppingIds?: string[],
  note?: string,
): Promise<void> {
  await api.post('/cart/items', { productId, quantity, selectedOptions, toppingIds, ...(note?.trim() ? { note: note.trim() } : {}) })
}

export async function updateCartItem(
  itemId: string,
  quantity: number,
  selectedOptions?: Record<string, string>,
  toppingIds?: string[],
  note?: string,
): Promise<void> {
  await api.patch(`/cart/items/${itemId}`, { quantity, selectedOptions, toppingIds, ...(note !== undefined ? { note: note.trim() || null } : {}) })
}

export async function removeCartItem(itemId: string): Promise<void> {
  await api.delete(`/cart/items/${itemId}`)
}

export async function removeCartItems(itemIds: string[]): Promise<void> {
  await api.delete('/cart/items', { data: { itemIds } })
}

export async function fetchProductById(id: string, locale?: string): Promise<ApiCartProduct> {
  const { data } = await api.get<ApiCartProduct>(`/products/${id}`, {
    params: locale ? { locale } : undefined,
  });
  return data;
}

/**
 * Fetch multiple products by id in parallel.
 * Returns a map productId -> fresh product, or `null` if the product
 * no longer exists (e.g. deleted / ParseUUIDPipe rejects it / 404).
 */
export async function fetchProductsByIds(
  ids: string[],
  locale?: string,
): Promise<Record<string, ApiCartProduct | null>> {
  const uniqueIds = Array.from(new Set(ids));
  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const product = await fetchProductById(id, locale);
        return [id, product] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  return Object.fromEntries(results);
}
