import { api } from '@/services/api'
import type { ApiProduct, ApiCategory } from '@/types'

export async function fetchCategories(): Promise<ApiCategory[]> {
  const res = await api.get<ApiCategory[]>('/categories', { params: { locale: 'vi' } })
  return res.data
}

export async function fetchProducts(params?: {
  categoryId?: string
  categorySlug?: string
}): Promise<ApiProduct[]> {
  const res = await api.get<ApiProduct[]>('/products', {
    params: { ...params, locale: 'vi' },
  })
  return res.data
}

export async function fetchProductBySlug(slug: string): Promise<ApiProduct> {
  const res = await api.get<ApiProduct>(`/products/by-slug/${slug}`, {
    params: { locale: 'vi' },
  })
  return res.data
}
