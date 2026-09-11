import { useQuery } from '@tanstack/react-query'
import { fetchPublicStoreLocation, fetchPublicDeliveryPlatforms, fetchPublicStoreStatus } from './api'

export function usePublicStoreLocationQuery() {
  return useQuery({
    queryKey: ['store', 'location'],
    queryFn: fetchPublicStoreLocation,
    staleTime: 5 * 60 * 1000,
  })
}

export function useStoreStatusQuery() {
  return useQuery({
    queryKey: ["store", "status"],
    queryFn: fetchPublicStoreStatus,
    staleTime: 30_000,
    refetchInterval: 60_000, // để modal tự cập nhật nếu admin đổi trạng thái khi khách đang browse
    refetchOnWindowFocus: true,
  });
}

export function usePublicDeliveryPlatformsQuery() {
  return useQuery({
    queryKey: ['store', 'platforms'],
    queryFn: fetchPublicDeliveryPlatforms,
    staleTime: 10 * 60 * 1000,
  })
}
