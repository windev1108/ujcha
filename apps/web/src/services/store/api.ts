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

export interface PublicDeliveryPlatform {
  id: string
  name: string
  link: string
  thumbnailUrl: string
  displayMode: 'logo_and_text' | 'logo_only'
  logoWidth: number
  logoHeight: number
}

export async function fetchPublicStoreLocation(): Promise<PublicStoreLocation> {
  const { data } = await api.get<PublicStoreLocation>('/tables/store-location')
  return data
}

export async function fetchPublicDeliveryPlatforms(): Promise<PublicDeliveryPlatform[]> {
  const { data } = await api.get<PublicDeliveryPlatform[]>('/store/platforms')
  return data
}
