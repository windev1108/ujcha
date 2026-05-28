import { api } from '@/config/server'

export interface ActiveCampaign {
  id: string
  name: string
  earnPercent: string
  baseEarnPercent: string
  pointRate: number
  startAt: string
  endAt: string
}

export async function fetchActiveCampaign(): Promise<ActiveCampaign | null> {
  const { data } = await api.get<ActiveCampaign | null>('/campaigns/active')
  return data
}
