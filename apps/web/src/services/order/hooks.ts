'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyOrderPoints,
  createAddress,
  createOrder,
  deleteAddress,
  fetchAddresses,
  fetchMyOrders,
  fetchOrderDetail,
  fetchPointConfig,
  previewVoucher,
  setDefaultAddress,
  updateAddress,
  type CreateAddressPayload,
  type CreateOrderPayload,
  type UpdateAddressPayload,
} from './api'
import { useAuthStore } from '@/store/auth-store'

export const addressKeys = {
  list: ['addresses'] as const,
}

export function useAddressesQuery() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: addressKeys.list,
    queryFn: fetchAddresses,
    staleTime: 60_000,
    enabled: !!accessToken,
  })
}

export const orderKeys = {
  myOrders: (page: number) => ['my-orders', page] as const,
  detail: (id: string) => ['order-detail', id] as const,
}

export function useOrderDetailQuery(paymentCode: string) {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: orderKeys.detail(paymentCode),
    queryFn: () => fetchOrderDetail(paymentCode),
    staleTime: 0,
    enabled: !!accessToken && !!paymentCode,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (data.paymentType !== 'bank_transfer') return false
      if (data.paymentStatus !== 'pending') return false
      if (data.status === 'cancelled') return false
      const elapsed = Date.now() - new Date(data.createdAt).getTime()
      if (elapsed > 16 * 60_000) return false
      return 10_000
    },
  })
}

export function useMyOrdersQuery(page = 1) {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: orderKeys.myOrders(page),
    queryFn: () => fetchMyOrders(page),
    staleTime: 30_000,
    enabled: !!accessToken,
  })
}

export function useCreateAddressMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAddressPayload) => createAddress(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.list })
    },
  })
}

export function useUpdateAddressMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAddressPayload }) =>
      updateAddress(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.list })
    },
  })
}

export function useDeleteAddressMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.list })
    },
  })
}

export function useSetDefaultAddressMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: addressKeys.list })
    },
  })
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => createOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      queryClient.invalidateQueries({ queryKey: ['my-vouchers'] })
    },
  })
}

export function usePointConfigQuery() {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: ['point-config'],
    queryFn: fetchPointConfig,
    staleTime: 5 * 60_000,
    enabled: !!accessToken,
  })
}

export function usePreviewVoucherMutation() {
  return useMutation({
    mutationFn: ({ code, orderAmount }: { code: string; orderAmount: number }) =>
      previewVoucher(code, orderAmount),
  })
}

export function useApplyOrderPointsMutation() {
  return useMutation({
    mutationFn: ({ orderId, pointToUse }: { orderId: string; pointToUse: number }) =>
      applyOrderPoints(orderId, pointToUse),
  })
}
