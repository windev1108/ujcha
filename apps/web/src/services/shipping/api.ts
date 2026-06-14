import { api } from '@/config/server'

export interface ShippingEstimate {
  distanceKm: number
  fee: number
  isFree: boolean
  isOutOfRange: boolean
  isDisabled: boolean
  freeShipDistanceKm: number
}

export interface PublicShippingConfig {
  isActive: boolean
  baseFee: number
  baseKm: number
  feePerKm: number
  maxDistanceKm: number
  freeThreshold: number
  freeShipDistanceKm: number
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

export async function fetchPublicShippingConfig(): Promise<PublicShippingConfig> {
  const { data } = await api.get<PublicShippingConfig>('/shipping/config')
  return data
}
