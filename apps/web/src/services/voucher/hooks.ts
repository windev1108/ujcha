'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth-store'
import { fetchMyVouchers } from './api'

export function useMyVouchersQuery() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['my-vouchers'],
    queryFn: fetchMyVouchers,
    staleTime: 60_000,
    enabled: !!accessToken,
  })
}
