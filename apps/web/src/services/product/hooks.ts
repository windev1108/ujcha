'use client'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { fetchProducts, fetchProductBySlug } from './api'
import { productKeys } from './keys'

export function useProductsQuery(options?: { categoryId?: string; categorySlug?: string }) {
  const locale = useLocale()
  const filterKey = options?.categorySlug ?? options?.categoryId
  return useQuery({
    queryKey: [...productKeys.list(filterKey), locale],
    queryFn: () => fetchProducts({ ...options, locale }),
    staleTime: 5 * 60_000,
  })
}

export function useProductBySlugQuery(slug: string) {
  const locale = useLocale()
  return useQuery({
    queryKey: [...productKeys.detail(slug), locale],
    queryFn: () => fetchProductBySlug(slug, locale),
    staleTime: 5 * 60_000,
    enabled: !!slug,
  })
}
