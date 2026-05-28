import { api } from '@/config/server'

export interface ShippingEstimate {
  distanceKm: number
  fee: number
  isFree: boolean
  isOutOfRange: boolean
  isDisabled: boolean
}

export async function fetchShippingEstimate(
  lat: number,
  lng: number,
  amount = 0,
): Promise<ShippingEstimate> {
  const { data } = await api.get<ShippingEstimate>('/shipping/estimate', {
    params: { lat, lng, amount },
  })
  return data
}
