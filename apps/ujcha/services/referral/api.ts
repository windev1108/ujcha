import { api } from '@/services/api'
import type { ReferralStats, ReferralMilestone } from '@/types'

export async function fetchReferralMyStats(): Promise<ReferralStats> {
  const res = await api.get<ReferralStats>('/referral/my-stats')
  return res.data
}

export async function fetchReferralPublicConfig(): Promise<{ milestones: ReferralMilestone[] }> {
  const res = await api.get('/referral/public-config')
  return res.data
}

export async function claimMilestone(milestoneId: string): Promise<void> {
  await api.post('/referral/claim-milestone', { milestoneId })
}

export async function fetchLeaderboard(): Promise<{ rank: number; name: string; avatar: string | null; count: number }[]> {
  const res = await api.get('/referral/leaderboard')
  return res.data
}
