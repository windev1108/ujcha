import { api } from '@/config/server'
import type { ApiProduct, ApiTopping } from './types'

export async function fetchProducts(
  options?: { categoryId?: string; categorySlug?: string },
): Promise<ApiProduct[]> {
  const { data } = await api.get<ApiProduct[]>('/products', {
    params: options ?? undefined,
  })
  return data
}

export async function fetchProductBySlug(slug: string): Promise<ApiProduct> {
  const { data } = await api.get<ApiProduct>(`/products/by-slug/${slug}`)
  return data
}

export async function fetchToppings(): Promise<ApiTopping[]> {
  const { data } = await api.get<ApiTopping[]>('/toppings')
  return data
}
