'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchPromotions } from './api'

export const promotionKeys = {
  all: ['promotions'] as const,
}

export function usePromotionsQuery() {
  return useQuery({
    queryKey: promotionKeys.all,
    queryFn: fetchPromotions,
    staleTime: 5 * 60_000,
  })
}
