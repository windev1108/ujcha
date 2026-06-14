import { api } from '@/services/api'
import type {
  UserOrder,
  OrderDetail,
  CreateOrderPayload,
  UserAddress,
  PointRewardCatalog,
  PaymentConfig,
} from '@/types'

// ─── Addresses ───────────────────────────────────────────────────────────────

export async function fetchAddresses(): Promise<UserAddress[]> {
  const res = await api.get<UserAddress[]>('/addresses')
  return res.data
}

export async function createAddress(payload: Omit<UserAddress, 'id' | 'isDefault'>): Promise<UserAddress> {
  const res = await api.post<UserAddress>('/addresses', payload)
  return res.data
}

export async function updateAddress(id: string, payload: Partial<Omit<UserAddress, 'id'>>): Promise<UserAddress> {
  const res = await api.patch<UserAddress>(`/addresses/${id}`, payload)
  return res.data
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete(`/addresses/${id}`)
}

export async function setDefaultAddress(id: string): Promise<void> {
  await api.patch(`/addresses/${id}/default`)
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function createOrder(payload: CreateOrderPayload): Promise<UserOrder> {
  const res = await api.post<UserOrder>('/orders', payload)
  return res.data
}

export async function fetchMyOrders(page = 1, pageSize = 10): Promise<{
  data: UserOrder[]
  total: number
  page: number
  pageSize: number
}> {
  const res = await api.get('/orders', { params: { page, pageSize } })
  return res.data
}

export async function fetchOrderDetail(paymentCode: string): Promise<OrderDetail> {
  const res = await api.get<OrderDetail>(`/orders/by-code/${paymentCode}`)
  return res.data
}

export async function previewVoucher(payload: {
  voucherCode: string
  subtotal: number
  type: string
}): Promise<{ discountAmount: number; finalAmount: number }> {
  const res = await api.post('/orders/voucher-preview', payload)
  return res.data
}

export async function fetchPointConfig(): Promise<{ earnRate: number; redeemRate: number }> {
  const res = await api.get('/orders/point-config')
  return res.data
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export async function fetchPointRewardCatalog(): Promise<PointRewardCatalog[]> {
  const res = await api.get<PointRewardCatalog[]>('/point-rewards')
  return res.data
}

export async function redeemPointReward(catalogId: string): Promise<{ code: string }> {
  const res = await api.post<{ code: string }>(`/point-rewards/${catalogId}/redeem`)
  return res.data
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export async function fetchPublicPaymentConfig(): Promise<PaymentConfig> {
  const res = await api.get<PaymentConfig>('/payment-config')
  return res.data
}
