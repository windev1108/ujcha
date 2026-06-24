import { api } from '@/config/server'

export type GroupOrderStatus = 'collecting' | 'locked' | 'completed' | 'cancelled'
export type GroupPaymentMode = 'host_pays' | 'split'
export type GroupParticipantPaymentStatus = 'pending' | 'paid'
export type GroupParticipantPaymentType = 'cash' | 'bank_transfer'

export interface GroupOrderItem {
  id: string
  productId: string
  product: { id: string; name: string; nameTranslation?: Record<string, string> | null; imageUrls: string[]; price: string; optionGroups?: unknown }
  quantity: number
  unitPrice: number
  selectedOptions: Record<string, string>
  toppings: Array<{ toppingId: string; name: string; price: number; nameTranslation?: Record<string, string> }>
  note: string | null
}

export interface GroupOrderParticipant {
  id: string
  userId: string | null
  name: string
  avatar: string | null
  isHost: boolean
  isReady: boolean
  paymentStatus: GroupParticipantPaymentStatus
  paymentType: GroupParticipantPaymentType | null
  paymentQrToken: string | null
  paidAt: string | null
  joinedAt: string
  subtotal: number
  items: GroupOrderItem[]
}

export interface GroupOrderState {
  id: string
  token: string
  status: GroupOrderStatus
  paymentMode: GroupPaymentMode
  paymentType: 'cash' | 'bank_transfer'
  type: 'delivery' | 'pickup' | 'table'
  shippingFee: number
  shippingFeeMode: 'split' | 'host_pays'
  note: string | null
  expiresAt: string
  createdAt: string
  address: { id: string; fullAddress: string } | null
  table: { id: string; name: string; area: string } | null
  orderId: string | null
  order: { id: string; paymentCode: string; status: string } | null
  participants: GroupOrderParticipant[]
}

export interface GroupDiscountTier {
  minParticipants: number
  discountPercent: number
}

export interface GroupOrderConfig {
  id: string
  isEnabled: boolean
  expiryMinutes: number
  discountTiers: GroupDiscountTier[]
}

export async function createGroupOrder(payload: {
  type: 'delivery' | 'pickup' | 'table'
  paymentMode: 'host_pays' | 'split'
  deviceId?: string
  addressId?: string
  tableId?: string
  pickupTime?: string
  shippingFee?: number
  note?: string
}): Promise<GroupOrderState & { hostSessionToken: string; hostParticipantId?: string }> {
  const { data } = await api.post('/group-orders', payload)
  return data
}

export interface MyGroupOrderSession {
  token: string
  type: 'delivery' | 'pickup' | 'table'
  status: GroupOrderStatus
  expiresAt: string
  paymentMode: GroupPaymentMode
  participantCount: number
}

export async function fetchMyGroupOrderSessions(): Promise<MyGroupOrderSession[]> {
  const { data } = await api.get<MyGroupOrderSession[]>('/group-orders/my')
  return data
}

export async function fetchGroupOrder(token: string): Promise<GroupOrderState> {
  const { data } = await api.get<GroupOrderState>(`/group-orders/${token}`)
  return data
}

export async function joinGroupOrder(
  token: string,
  payload?: { deviceId?: string; guestName?: string },
): Promise<{ sessionToken: string; participantId: string; alreadyJoined: boolean }> {
  const { data } = await api.post(`/group-orders/${token}/join`, payload ?? {})
  return data
}

export async function updateGroupOrderItems(
  token: string,
  sessionToken: string,
  items: Array<{
    productId: string
    quantity: number
    selectedOptions?: Record<string, string>
    toppings?: Array<{ toppingId: string; name: string; price: number; nameTranslation?: Record<string, string> }>
    note?: string
  }>,
): Promise<GroupOrderState> {
  const { data } = await api.put<GroupOrderState>(`/group-orders/${token}/items`, {
    sessionToken,
    items,
  })
  return data
}

export async function markGroupOrderReady(
  token: string,
  sessionToken: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/ready`, { sessionToken })
  return data
}

export async function lockGroupOrder(
  token: string,
  sessionToken: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/lock`, { sessionToken })
  return data
}

export async function initHostBankTransfer(
  token: string,
  sessionToken: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/init-host-bank-transfer`, { sessionToken })
  return data
}

export async function checkoutHostPays(
  token: string,
  sessionToken: string,
  paymentType: 'cash' | 'bank_transfer',
): Promise<{ groupOrder: GroupOrderState; order: unknown }> {
  const { data } = await api.post(`/group-orders/${token}/checkout`, { sessionToken, paymentType })
  return data
}

export async function initSplitPayment(
  token: string,
  sessionToken: string,
  paymentType: 'cash' | 'bank_transfer',
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/split-payment`, {
    sessionToken,
    paymentType,
  })
  return data
}

export async function confirmParticipantPaid(
  token: string,
  sessionToken: string,
  participantId: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/confirm-paid`, {
    sessionToken,
    participantId,
  })
  return data
}

export async function unlockGroupOrder(
  token: string,
  sessionToken: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/unlock`, { sessionToken })
  return data
}

export async function dissolveGroupOrder(
  token: string,
  sessionToken: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/dissolve`, { sessionToken })
  return data
}

export async function kickGroupOrderParticipant(
  token: string,
  sessionToken: string,
  participantId: string,
): Promise<GroupOrderState> {
  const { data } = await api.post<GroupOrderState>(`/group-orders/${token}/kick`, {
    sessionToken,
    participantId,
  })
  return data
}

export async function setGroupOrderFulfillment(
  token: string,
  sessionToken: string,
  payload: {
    type: 'delivery' | 'pickup' | 'table'
    addressId?: string
    tableId?: string
    pickupTime?: string
    shippingFee?: number
    paymentType?: 'cash' | 'bank_transfer'
    shippingFeeMode?: 'split' | 'host_pays'
  },
): Promise<GroupOrderState> {
  const { data } = await api.patch<GroupOrderState>(`/group-orders/${token}/fulfillment`, {
    sessionToken,
    ...payload,
  })
  return data
}

export async function checkoutSplitCash(
  token: string,
  sessionToken: string,
): Promise<{ groupOrder: GroupOrderState; order: unknown }> {
  const { data } = await api.post(`/group-orders/${token}/checkout-split-cash`, { sessionToken })
  return data
}

export async function fetchGroupOrderConfig(): Promise<GroupOrderConfig> {
  const { data } = await api.get<GroupOrderConfig>('/group-orders/config/discount')
  return data
}
