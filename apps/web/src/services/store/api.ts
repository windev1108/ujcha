import { api } from '@/config/server'

export interface PublicStoreLocation {
  lat: number;
  lng: number;
  radiusMeters: number;
  address: string;
  phone: string | null;
}
export type StoreOperationStatus = "opening" | "closed" | "busy";

export interface StoreStatus {
  id: string;
  openMinutes: number;
  closeMinutes: number;
  status: StoreOperationStatus;
  statusReason: string | null;
  updatedAt: string;
  withinHours: boolean;
  effectiveStatus: StoreOperationStatus;
  isOpenForOrders: boolean;
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
  const { data } = await api.get<PublicStoreLocation>('/store/location')
  return data
}

export async function fetchPublicStoreStatus(): Promise<StoreStatus> {
  const { data } = await api.get("/store/status"); // đổi từ /tables/store-status
  return data;
}

export async function fetchPublicDeliveryPlatforms(): Promise<PublicDeliveryPlatform[]> {
  const { data } = await api.get<PublicDeliveryPlatform[]>('/store/platforms')
  return data
}
