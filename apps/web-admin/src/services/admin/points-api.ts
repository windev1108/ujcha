import { api } from "@/config/server";

import type {
  AdjustPointsBody,
  CreatePointCampaignBody,
  CreatePointRewardBody,
  PointCampaignSerialized,
  PointConfigCurrentResponse,
  PointConfigSerialized,
  PointRewardCatalogItem,
  PointSystemStats,
  PointTransactionsListResponse,
  UpdatePointCampaignBody,
  UpdatePointConfigBody,
  UpdatePointRewardBody,
} from "./types";

export async function fetchPointConfigCurrent(): Promise<PointConfigCurrentResponse> {
  const { data } = await api.get<PointConfigCurrentResponse>("/admin/point-config");
  return data;
}

export async function fetchPointSystemStats(): Promise<PointSystemStats> {
  const { data } = await api.get<PointSystemStats>("/admin/point-config/stats");
  return data;
}

export async function updatePointConfig(
  id: string,
  body: UpdatePointConfigBody,
): Promise<PointConfigSerialized> {
  const { data } = await api.patch<PointConfigSerialized>(
    `/admin/point-config/${id}`,
    body,
  );
  return data;
}

export async function fetchPointCampaigns(): Promise<PointCampaignSerialized[]> {
  const { data } = await api.get<PointCampaignSerialized[]>(
    "/admin/point-config/campaigns",
  );
  return data;
}

export async function createPointCampaign(
  body: CreatePointCampaignBody,
): Promise<PointCampaignSerialized> {
  const { data } = await api.post<PointCampaignSerialized>(
    "/admin/point-config/campaigns",
    body,
  );
  return data;
}

export async function updatePointCampaign(
  id: string,
  body: UpdatePointCampaignBody,
): Promise<PointCampaignSerialized> {
  const { data } = await api.patch<PointCampaignSerialized>(
    `/admin/point-config/campaigns/${id}`,
    body,
  );
  return data;
}

export async function togglePointCampaign(id: string): Promise<PointCampaignSerialized> {
  const { data } = await api.patch<PointCampaignSerialized>(
    `/admin/point-config/campaigns/${id}/toggle`,
  );
  return data;
}

export async function fetchPointTransactionsGlobal(params?: {
  limit?: number;
  skip?: number;
  type?: "earn" | "spend" | "expire";
}): Promise<PointTransactionsListResponse> {
  const { data } = await api.get<PointTransactionsListResponse>(
    "/admin/point-transactions",
    {
      params: {
        limit: params?.limit,
        skip: params?.skip,
        type: params?.type,
      },
    },
  );
  return data;
}

export async function adjustUserPoints(body: AdjustPointsBody): Promise<void> {
  await api.post("/admin/points/adjust", body);
}

// ── Point Reward Catalog ───────────────────────────────────────────────────────

export async function fetchPointRewardCatalogAdmin(): Promise<PointRewardCatalogItem[]> {
  const { data } = await api.get<PointRewardCatalogItem[]>("/admin/point-rewards");
  return data;
}

export async function createPointReward(body: CreatePointRewardBody): Promise<PointRewardCatalogItem> {
  const { data } = await api.post<PointRewardCatalogItem>("/admin/point-rewards", body);
  return data;
}

export async function updatePointReward(
  id: string,
  body: UpdatePointRewardBody,
): Promise<PointRewardCatalogItem> {
  const { data } = await api.patch<PointRewardCatalogItem>(`/admin/point-rewards/${id}`, body);
  return data;
}

export async function deletePointReward(id: string): Promise<void> {
  await api.delete(`/admin/point-rewards/${id}`);
}
