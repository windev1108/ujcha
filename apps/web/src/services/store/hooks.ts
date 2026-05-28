import { useQuery } from '@tanstack/react-query'
import { fetchPublicStoreLocation } from './api'

export function usePublicStoreLocationQuery() {
  return useQuery({
    queryKey: ['store', 'location'],
    queryFn: fetchPublicStoreLocation,
    staleTime: 5 * 60 * 1000,
  })
}
