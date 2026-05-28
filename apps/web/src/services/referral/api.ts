import { api } from '@/config/server';

export interface ReferralPublicConfig {
  isActive: boolean;
  referrerCommissionPercent: number;
  maxReferrerRewardsPerDay: number;
  minOrderAmount: string;
  blockSameIpAsReferrer: boolean;
  blockSameDeviceAsReferrer: boolean;
  bronzeThreshold: number;
  bronzePoints: number;
  silverThreshold: number;
  silverPoints: number;
  goldThreshold: number;
  goldPoints: number;
  diamondThreshold: number;
  diamondPoints: number;
}

export interface ReferralRecentReward {
  id: string;
  referredUserName: string;
  pointsGranted: number;
  status: string;
  createdAt: string;
}

export interface ReferralMyStats {
  inviteCount: number;
  successfulReferrals: number;
  rewardsToday: number;
  pointsEarned: number;
  vouchersEarned: number;
  recentRewards: ReferralRecentReward[];
  programConfig: ReferralPublicConfig | null;
}

export type InvitationStatus =
  | 'rewarded'
  | 'pending_first_order'
  | 'rejected_blocked_ip'
  | 'rejected_blocked_device'
  | 'rejected_phone_not_verified'
  | 'rejected_below_min_amount'
  | 'eligible_processing';

export interface ReferralInvitation {
  id: string;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  joinedAt: string;
  status: InvitationStatus;
  pointsGranted: number | null;
}

export async function fetchReferralMyStats(): Promise<ReferralMyStats> {
  const { data } = await api.get<ReferralMyStats>('/referral/my-stats');
  return data;
}

export async function fetchReferralMyInvitations(): Promise<ReferralInvitation[]> {
  const { data } = await api.get<ReferralInvitation[]>('/referral/my-invitations');
  return data;
}

export async function fetchReferralPublicConfig(): Promise<ReferralPublicConfig | null> {
  const { data } = await api.get<ReferralPublicConfig | null>('/referral/public-config');
  return data;
}

export type MilestoneTierId = 'bronze' | 'silver' | 'gold' | 'diamond';

export async function fetchClaimedMilestones(): Promise<MilestoneTierId[]> {
  const { data } = await api.get<MilestoneTierId[]>('/referral/my-claimed-milestones');
  return data;
}

export async function claimMilestone(tier: MilestoneTierId): Promise<{ points: number }> {
  const { data } = await api.post<{ points: number }>('/referral/claim-milestone', { tier });
  return data;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string | null;
  referralCode: string;
  successfulReferrals: number;
  tier: MilestoneTierId | null;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await api.get<LeaderboardEntry[]>('/referral/leaderboard');
  return data;
}
