import axios from 'axios'
import { usePosStore } from './store/pos-store'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000'

export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const { posConfig } = usePosStore.getState()
  if (posConfig.accessToken) {
    config.headers['Authorization'] = `Bearer ${posConfig.accessToken}`
  }
  return config
})

const eAPI = (window as unknown as {
  electronAPI?: { store: { set(d: Record<string, unknown>): Promise<void> } }
}).electronAPI

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const { posConfig, setPosConfig } = usePosStore.getState()
      if (!posConfig.refreshToken) return Promise.reject(err)
      try {
        const { data } = await axios.post(`${API_URL}/admin/auth/refresh`, {
          refreshToken: posConfig.refreshToken,
        })
        const updated = { ...posConfig, accessToken: data.accessToken }
        setPosConfig(updated)
        // Persist refreshed token so next app restart doesn't re-expire
        void eAPI?.store.set(updated as unknown as Record<string, unknown>)
        err.config.headers['Authorization'] = `Bearer ${data.accessToken}`
        return api.request(err.config)
      } catch {
        usePosStore.getState().logout()
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  },
)

// ── API helpers ────────────────────────────────────────────────────────────────
export const fetchCategories = () =>
  api.get<import('./types/common').Category[]>('/admin/categories').then((r) => r.data)

export const fetchProducts = (categoryId?: string) =>
  api.get<import('./types/common').Product[]>('/admin/products', {
    params: categoryId ? { categoryId } : {},
  }).then((r) => r.data)

export const fetchToppings = () =>
  api.get<import('./types/common').Topping[]>('/admin/toppings?activeOnly=true').then((r) => r.data)

export const fetchTables = () =>
  api.get<import('./types/common').Table[]>('/admin/tables').then((r) => r.data)

export const fetchPaymentConfig = () =>
  api.get<import('./types/common').PaymentConfig>('/admin/payment-config').then((r) => r.data)

export const fetchTtsConfig = () =>
  api.get<import('./types/common').TtsConfig>('/admin/shop-settings/tts-config').then((r) => r.data)

export const fetchOrders = (page = 1, pageSize = 100, from?: string, to?: string) =>
  api.get('/admin/orders', { params: { page, pageSize, ...(from && { from }), ...(to && { to }) } }).then((r) => r.data)

export const createOrder = (body: unknown) =>
  api.post<import('./types/common').AdminOrder>('/admin/orders', body).then((r) => r.data)

export const updateOrderStatus = (id: string, status: string, paymentStatus?: string) =>
  api.patch(`/admin/orders/${id}/status`, { status, ...(paymentStatus ? { paymentStatus } : {}) }).then((r) => r.data)

export const bulkUpdateOrderStatus = (orderIds: string[], status: string) =>
  api.patch<{ updated: number }>('/admin/orders/bulk-status', { orderIds, status }).then((r) => r.data)

export const fetchShippers = () =>
  api.get<{ id: string; name: string; phone?: string | null }[]>('/admin/shippers', {
    params: { activeOnly: 'true' },
  }).then((r) => r.data)

export const fetchShippingEstimate = (lat: number, lng: number) =>
  api.get<{ distanceKm: number; fee: number; isFree: boolean; isOutOfRange: boolean; isDisabled: boolean }>(
    '/shipping/estimate',
    { params: { lat, lng } },
  ).then((r) => r.data)

export const assignShipper = (orderId: string, shipperId: string) =>
  api.patch(`/admin/orders/${orderId}/assign-shipper`, { shipperId }).then((r) => r.data)

export interface CustomerLookupResult {
  id: string
  name: string
  phone: string | null
  email: string
  pointBalance: number
}

export const lookupCustomer = (q: string) =>
  api.get<CustomerLookupResult[]>('/admin/users', { params: { q } }).then((r) => r.data)

export const fetchReturningCustomers = (phones: string[], userIds: string[]) =>
  api.post<{ returningPhones: string[]; returningUserIds: string[] }>(
    '/admin/orders/returning-check',
    { phones, userIds },
  ).then((r) => r.data)

export const fetchExternalOrders = (page = 1, pageSize = 100, from?: string, to?: string) =>
  api.get('/admin/orders', {
    params: { page, pageSize, isExternal: true, ...(from && { from }), ...(to && { to }) },
  }).then((r) => r.data)

export interface GroupParticipantLive {
  id: string
  paymentStatus: 'pending' | 'paid'
  items: Array<unknown>
  isHost: boolean
}

export interface GroupOrderLive {
  token: string
  paymentMode: 'host_pays' | 'split'
  participants: GroupParticipantLive[]
}

export const fetchGroupOrderLive = (token: string) =>
  api.get<GroupOrderLive>(`/group-orders/${token}`).then((r) => r.data)
