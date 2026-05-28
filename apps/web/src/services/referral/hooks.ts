'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import {
  fetchReferralMyStats,
  fetchReferralMyInvitations,
  fetchReferralPublicConfig,
  fetchClaimedMilestones,
  fetchLeaderboard,
  claimMilestone,
  type MilestoneTierId,
} from './api';

export function useReferralStatsQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['referral-my-stats'],
    queryFn: fetchReferralMyStats,
    staleTime: 30_000,
    enabled: !!accessToken,
  });
}

export function useReferralInvitationsQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['referral-my-invitations'],
    queryFn: fetchReferralMyInvitations,
    staleTime: 30_000,
    enabled: !!accessToken,
  });
}

export function useReferralPublicConfigQuery() {
  return useQuery({
    queryKey: ['referral-public-config'],
    queryFn: fetchReferralPublicConfig,
    staleTime: 5 * 60_000,
  });
}

export function useClaimedMilestonesQuery() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['referral-claimed-milestones'],
    queryFn: fetchClaimedMilestones,
    staleTime: 60_000,
    enabled: !!accessToken,
  });
}

export function useReferralLeaderboardQuery() {
  return useQuery({
    queryKey: ['referral-leaderboard'],
    queryFn: fetchLeaderboard,
    staleTime: 2 * 60_000,
  });
}

export function useClaimMilestoneMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tier: MilestoneTierId) => claimMilestone(tier),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['referral-claimed-milestones'] });
      void qc.invalidateQueries({ queryKey: ['referral-my-stats'] });
    },
  });
}
