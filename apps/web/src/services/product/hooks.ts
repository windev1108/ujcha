'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchProducts, fetchProductBySlug, fetchToppings } from './api'
import { productKeys } from './keys'

export function useProductsQuery(options?: { categoryId?: string; categorySlug?: string }) {
  const filterKey = options?.categorySlug ?? options?.categoryId
  return useQuery({
    queryKey: productKeys.list(filterKey),
    queryFn: () => fetchProducts(options),
    staleTime: 5 * 60_000,
  })
}

export function useProductBySlugQuery(slug: string) {
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => fetchProductBySlug(slug),
    staleTime: 5 * 60_000,
    enabled: !!slug,
  })
}

export function useToppingsQuery() {
  return useQuery({
    queryKey: ['toppings'],
    queryFn: fetchToppings,
    staleTime: 10 * 60_000,
  })
}
