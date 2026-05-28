import { api } from "@/config/server";

import type {
  AdminReferralDashboard,
  AdminReferralProgramConfig,
  AdminReferralRewardsResponse,
  AdminReferralUsersPage,
  UpdateReferralProgramBody,
} from "./types";

export async function fetchReferralDashboard(): Promise<AdminReferralDashboard> {
  const { data } = await api.get<AdminReferralDashboard>(
    "/admin/referrals/dashboard",
  );
  return data;
}

export async function fetchReferralUsers(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminReferralUsersPage> {
  const { data } = await api.get<AdminReferralUsersPage>(
    "/admin/referrals/users",
    { params },
  );
  return data;
}

export async function fetchReferralProgramConfig(): Promise<AdminReferralProgramConfig | null> {
  const { data } = await api.get<AdminReferralProgramConfig | null>(
    "/admin/referrals/program-config",
  );
  return data;
}

export async function updateReferralProgramConfig(
  body: UpdateReferralProgramBody,
): Promise<AdminReferralProgramConfig | null> {
  const { data } = await api.patch<AdminReferralProgramConfig | null>(
    "/admin/referrals/program-config",
    body,
  );
  return data;
}

export async function fetchReferralRewards(params?: {
  limit?: number;
  skip?: number;
}): Promise<AdminReferralRewardsResponse> {
  const { data } = await api.get<AdminReferralRewardsResponse>(
    "/admin/referrals/rewards",
    { params },
  );
  return data;
}
