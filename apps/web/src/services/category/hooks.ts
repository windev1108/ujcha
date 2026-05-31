'use client'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { fetchCategories } from './api'
import { categoryKeys } from './keys'

export function useCategoriesQuery() {
  const locale = useLocale()
  return useQuery({
    queryKey: [...categoryKeys.list(), locale],
    queryFn: () => fetchCategories(locale),
    staleTime: 10 * 60_000,
  })
}
