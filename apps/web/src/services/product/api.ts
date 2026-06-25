import { api } from '@/config/server'
import type { ApiProduct } from './types'

export async function fetchProducts(
  options?: { categoryId?: string; categorySlug?: string; locale?: string },
): Promise<ApiProduct[]> {
  const { data } = await api.get<ApiProduct[]>('/products', {
    params: {
      ...(options?.categoryId && { categoryId: options.categoryId }),
      ...(options?.categorySlug && { categorySlug: options.categorySlug }),
      ...(options?.locale && { locale: options.locale }),
    },
  })
  return data
}

export async function fetchProductBySlug(slug: string, locale?: string): Promise<ApiProduct> {
  const { data } = await api.get<ApiProduct>(`/products/by-slug/${slug}`, {
    params: locale ? { locale } : undefined,
  })
  return data
}

export async function fetchProductById(id: string): Promise<ApiProduct> {
  const { data } = await api.get<ApiProduct>(`/products/${id}`)
  return data
}
