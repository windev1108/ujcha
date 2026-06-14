import { api } from '@/services/api'

export async function fetchShippingEstimate(
  lat: number,
  lng: number,
  amount: number,
): Promise<{ fee: number; distanceKm: number; estimatedMinutes: number }> {
  const res = await api.get('/shipping/estimate', { params: { lat, lng, amount } })
  return res.data
}
