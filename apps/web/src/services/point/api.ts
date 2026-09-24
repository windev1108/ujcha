import { api } from '@/config/server';

export interface PublicPointConfig {
  pointRate: number;
  maxUsagePercent: number;
  minOrderAmountToSpend: number;
}

export async function fetchPublicPointConfig(): Promise<PublicPointConfig | null> {
  const { data } = await api.get<PublicPointConfig | null>('/point-config/public');
  return data;
}