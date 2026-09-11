import { api } from "@/config/server";

export type DisplayMode = 'logo_and_text' | 'logo_only';

export type StoreOperationStatus = "opening" | "closed" | "busy";

export interface StoreStatusConfig {
  id: string;
  openMinutes: number;
  closeMinutes: number;
  status: StoreOperationStatus;
  statusReason: string | null;
  updatedAt: string;
}

export type DeliveryPlatform = {
  id: string;
  name: string;
  link: string;
  thumbnailUrl: string;
  sortOrder: number;
  isActive: boolean;
  displayMode: DisplayMode;
  logoWidth: number;
  logoHeight: number;
  createdAt: string;
  updatedAt: string;
};

export type CreatePlatformBody = {
  name: string;
  link: string;
  thumbnailUrl: string;
  sortOrder?: number;
  isActive?: boolean;
  displayMode?: DisplayMode;
  logoWidth?: number;
  logoHeight?: number;
};

export async function fetchDeliveryPlatforms(): Promise<DeliveryPlatform[]> {
  const { data } = await api.get<DeliveryPlatform[]>("/admin/store/platforms");
  return data;
}

export async function createDeliveryPlatform(body: CreatePlatformBody): Promise<DeliveryPlatform> {
  const { data } = await api.post<DeliveryPlatform>("/admin/store/platforms", body);
  return data;
}

export async function updateDeliveryPlatform(
  id: string,
  body: Partial<CreatePlatformBody>,
): Promise<DeliveryPlatform> {
  const { data } = await api.patch<DeliveryPlatform>(`/admin/store/platforms/${id}`, body);
  return data;
}

export async function deleteDeliveryPlatform(id: string): Promise<void> {
  await api.delete(`/admin/store/platforms/${id}`);
}

export async function fetchStoreStatusConfig(): Promise<StoreStatusConfig> {
  const { data } = await api.get("/admin/store/status");
  return data;
}

export async function updateStoreStatusConfig(payload: {
  openMinutes?: number;
  closeMinutes?: number;
  status?: StoreOperationStatus;
  statusReason?: string;
}): Promise<StoreStatusConfig> {
  const { data } = await api.patch("/admin/store/status", payload);
  return data;
}