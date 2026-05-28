import { api } from "@/config/server";

export interface GroupDiscountTier {
  minParticipants: number;
  discountPercent: number;
}

export interface GroupOrderConfig {
  id: string;
  isEnabled: boolean;
  expiryMinutes: number;
  discountTiers: GroupDiscountTier[];
}

export async function fetchGroupOrderConfig(): Promise<GroupOrderConfig> {
  const { data } = await api.get<GroupOrderConfig>("/admin/group-orders/config");
  return data;
}

export async function updateGroupOrderConfig(
  body: Partial<Pick<GroupOrderConfig, "isEnabled" | "expiryMinutes" | "discountTiers">>,
): Promise<GroupOrderConfig> {
  const { data } = await api.put<GroupOrderConfig>("/admin/group-orders/config", body);
  return data;
}
