'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchToppings } from './api'

export function useToppingsQuery() {
  return useQuery({
    queryKey: ['toppings'],
    queryFn: fetchToppings,
    staleTime: 10 * 60_000,
  })
}
