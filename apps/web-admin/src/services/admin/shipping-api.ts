import { api } from "@/config/server";

export interface ShippingConfig {
  id: string;
  isActive: boolean;
  baseFee: number;
  baseKm: number;
  feePerKm: number;
  maxDistanceKm: number;
  freeThreshold: number;
  freeShipDistanceKm: number;
  updatedAt: string;
}

export interface UpdateShippingConfigBody {
  isActive?: boolean;
  baseFee?: number;
  baseKm?: number;
  feePerKm?: number;
  maxDistanceKm?: number;
  freeThreshold?: number;
  freeShipDistanceKm?: number;
}

export async function fetchShippingConfig(): Promise<ShippingConfig> {
  const { data } = await api.get<ShippingConfig>("/admin/shipping/config");
  return data;
}

export async function updateShippingConfig(body: UpdateShippingConfigBody): Promise<ShippingConfig> {
  const { data } = await api.put<ShippingConfig>("/admin/shipping/config", body);
  return data;
}
