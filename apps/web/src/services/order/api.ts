import { api } from '@/config/server'

export interface CreateOrderItem {
  productId: string
  quantity: number
  price: number
  options?: Record<string, string>
  extras?: { toppingId: string }[]
  note?: string
}

export interface CreateAddressPayload {
  fullAddress: string
  lat: number
  lng: number
  note?: string
  isDefault?: boolean
}

export interface CreatedAddress {
  id: string
  fullAddress: string
}

export interface CreateOrderPayload {
  type: 'delivery' | 'pickup' | 'table'
  paymentType: 'cash' | 'bank_transfer'
  addressId?: string
  pickupTime?: string
  tableId?: string
  items: CreateOrderItem[]
  voucherCode?: string
  discountAmount?: number
  shippingFee?: number
}

export interface PublicTableInfo {
  id: string
  name: string
  area: string
  isActive: boolean
}

export async function fetchPublicTable(id: string): Promise<PublicTableInfo> {
  const { data } = await api.get<PublicTableInfo>(`/tables/${id}`)
  return data
}

export interface CreatedOrder {
  id: string
  paymentCode: string
  totalAmount: string
  paymentType: string
  type: string
}

export async function createAddress(payload: CreateAddressPayload): Promise<CreatedAddress> {
  const { data } = await api.post<CreatedAddress>('/addresses', payload)
  return data
}

export interface UserAddress {
  id: string
  fullAddress: string
  lat: number
  lng: number
  note: string | null
  isDefault: boolean
  createdAt: string
}

export async function fetchAddresses(): Promise<UserAddress[]> {
  const { data } = await api.get('/addresses')
  return data
}

export interface UpdateAddressPayload {
  fullAddress?: string
  lat?: number
  lng?: number
  note?: string
  isDefault?: boolean
}

export async function updateAddress(id: string, payload: UpdateAddressPayload): Promise<UserAddress> {
  const { data } = await api.patch<UserAddress>(`/addresses/${id}`, payload)
  return data
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete(`/addresses/${id}`)
}

export async function setDefaultAddress(id: string): Promise<UserAddress> {
  const { data } = await api.patch<UserAddress>(`/addresses/${id}/default`)
  return data
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreatedOrder> {
  const { data } = await api.post<CreatedOrder>('/orders', payload)
  return data
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'picked_up' | 'arrived' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentType = 'cash' | 'bank_transfer'
export type OrderType = 'delivery' | 'pickup' | 'table'

export interface UserOrderItem {
  id: string
  productId: string
  quantity: number
  price: string
  extrasJson: unknown
  optionsJson: unknown
  note: string | null
  product: { id: string; name: string; imageUrls: string[] }
}

export interface UserOrder {
  id: string
  type: OrderType
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentType: PaymentType
  totalAmount: string
  discountAmount: string
  pointDiscountAmount: string
  shippingFee: string
  finalAmount: string
  paymentCode: string
  pickupTime: string | null
  createdAt: string
  items: UserOrderItem[]
  address: { id: string; fullAddress: string } | null
  earnedPoints: number
  isGroupOrder: boolean
  groupOrderToken: string | null
}

export interface MyOrdersResponse {
  items: UserOrder[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function fetchMyOrders(page = 1, pageSize = 10): Promise<MyOrdersResponse> {
  const { data } = await api.get<MyOrdersResponse>('/orders', { params: { page, pageSize } })
  return data
}

export interface VoucherPreviewResult {
  valid: true
  code: string
  name: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  discountAmount: number
  maxDiscountAmount: number | null
  minOrderAmount: number
}

export async function previewVoucher(code: string, orderAmount: number): Promise<VoucherPreviewResult> {
  const { data } = await api.post<VoucherPreviewResult>('/orders/voucher-preview', { code, orderAmount })
  return data
}

export interface PointPreviewResult {
  baseSubtotalBeforePoints: string
  maxUsableMoney: string
  moneyFromPoints: string
  actualDiscountMoney: string
  pointsToSpend: number
  finalAmount: string
  meetsMinOrderAmount: boolean
  pointBalance: number
  sufficientPoints: boolean
}

export async function previewOrderPoints(orderId: string, pointToUse: number): Promise<PointPreviewResult> {
  const { data } = await api.post<PointPreviewResult>(`/orders/${orderId}/points/preview`, { pointToUse })
  return data
}

export async function applyOrderPoints(orderId: string, pointToUse: number): Promise<void> {
  await api.patch(`/orders/${orderId}/points`, { pointToUse })
}

export interface PointRedemptionConfig {
  pointRate: number
  maxUsagePercent: number
  minOrderAmount: number
}

export async function fetchPointConfig(): Promise<PointRedemptionConfig | null> {
  const { data } = await api.get<PointRedemptionConfig | null>('/orders/point-config')
  return data
}

export interface OrderDetailItem {
  id: string
  productId: string
  quantity: number
  price: string
  extrasJson: unknown
  optionsJson: unknown
  optionDetailsJson: unknown
  note: string | null
  product: { id: string; name: string; imageUrls: string[] }
}

export interface OrderDetail extends Omit<UserOrder, 'items' | 'address'> {
  items: OrderDetailItem[]
  table: { id: string; name: string; area: string | null } | null
  loyaltyQrToken: string | null
  address: { id: string; fullAddress: string; lat?: number; lng?: number } | null
  guestDeliveryName: string | null
  guestDeliveryPhone: string | null
  shipper: { id: string; name: string; phone: string | null } | null
  // Per-status timestamps (null for statuses not yet reached or pre-migration orders)
  confirmedAt: string | null
  preparingAt: string | null
  readyAt: string | null
  deliveringAt: string | null
  pickedUpAt: string | null
  arrivedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
}

export async function fetchOrderDetail(paymentCode: string): Promise<OrderDetail> {
  const { data } = await api.get<OrderDetail>(`/orders/by-code/${paymentCode}`)
  return data
}

// ── Point Rewards ─────────────────────────────────────────────────────────────

export interface PointRewardVoucher {
  id: string
  code: string
  name: string
  discountType: 'percent' | 'fixed_amount'
  discountValue: string
  minOrderAmount: string
  maxDiscountAmount: string | null
  endsAt: string | null
}

export interface PointRewardCatalogItem {
  id: string
  name: string
  description: string | null
  pointCost: number
  imageUrl: string | null
  isActive: boolean
  sortOrder: number
  voucher: PointRewardVoucher
}

export async function fetchPointRewardCatalog(): Promise<PointRewardCatalogItem[]> {
  const { data } = await api.get<PointRewardCatalogItem[]>('/point-rewards')
  return data
}

export async function redeemPointReward(catalogId: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>(`/point-rewards/${catalogId}/redeem`)
  return data
}
