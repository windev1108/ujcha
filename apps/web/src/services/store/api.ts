import { api } from '@/config/server'

export interface PublicStoreLocation {
  lat: number
  lng: number
  radiusMeters: number
  address: string
  phone: string | null
  shiftConfig: {
    startMinutes: number
    endMinutes: number
    toleranceMinutes: number
  }
}

export async function fetchPublicStoreLocation(): Promise<PublicStoreLocation> {
  const { data } = await api.get<PublicStoreLocation>('/tables/store-location')
  return data
}
