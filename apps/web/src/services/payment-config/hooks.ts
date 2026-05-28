'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchPublicPaymentConfig } from './api'

export const paymentConfigKeys = {
  config: ['payment-config'] as const,
}

export function usePublicPaymentConfigQuery() {
  return useQuery({
    queryKey: paymentConfigKeys.config,
    queryFn: fetchPublicPaymentConfig,
    staleTime: 5 * 60_000,
  })
}
