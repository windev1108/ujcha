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

export interface PointConfigPublic {
  earnPercent: string
  pointRate: number
}

export interface PromotionsData {
  campaign: ActiveCampaign | null
  pointConfig: PointConfigPublic | null
}

export async function fetchPromotions(): Promise<PromotionsData> {
  const { data } = await api.get<PromotionsData>('/promotions')
  return data
}
