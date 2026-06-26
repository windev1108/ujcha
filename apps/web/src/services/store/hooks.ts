import { useQuery } from '@tanstack/react-query'
import { fetchPublicStoreLocation, fetchPublicDeliveryPlatforms } from './api'

export function usePublicStoreLocationQuery() {
  return useQuery({
    queryKey: ['store', 'location'],
    queryFn: fetchPublicStoreLocation,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePublicDeliveryPlatformsQuery() {
  return useQuery({
    queryKey: ['store', 'platforms'],
    queryFn: fetchPublicDeliveryPlatforms,
    staleTime: 10 * 60 * 1000,
  })
}
