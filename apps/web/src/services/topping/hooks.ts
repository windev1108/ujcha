'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchOutOfStockToppingNames, fetchToppings } from './api'

export function useToppingsQuery() {
  return useQuery({
    queryKey: ['toppings'],
    queryFn: fetchToppings,
    staleTime: 10 * 60_000,
  })
}

export function useOutOfStockToppingNames() {
  return useQuery({
    queryKey: ["toppings", "out-of-stock"],
    queryFn: fetchOutOfStockToppingNames,
    staleTime: 30_000,
  });
}