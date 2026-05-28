'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchActiveCampaign } from './api'

export function useActiveCampaignQuery() {
  return useQuery({
    queryKey: ['campaign', 'active'],
    queryFn: fetchActiveCampaign,
    staleTime: 5 * 60_000,
  })
}
