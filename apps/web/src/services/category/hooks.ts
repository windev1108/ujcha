'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from './api'
import { categoryKeys } from './keys'

export function useCategoriesQuery() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  })
}
