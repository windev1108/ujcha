import { api } from '@/config/server'
import { PublicAnnouncement, PublicDeliveryPlatform, PublicStoreLocation, StoreStatus } from './types';


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


export async function fetchStoreAnnouncement(): Promise<PublicAnnouncement> {
  const { data } = await api.get<PublicAnnouncement>('/store/announcement')
  return data
}
