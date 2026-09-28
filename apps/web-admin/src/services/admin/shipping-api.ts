import { api } from "@/config/server";

export interface WeatherTier {
  label: string;
  /** Mưa: mm/h — Gió giật: km/h */
  minValue: number;
  fee: number;
}

export interface WeatherSnapshot {
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  fetchedAt: string;
  rainFee: number;
  windFee: number;
  thunderstormFee: number;
  reason: string | null;
}

export interface ShippingConfig {
  id: string;
  isActive: boolean;
  baseFee: number;
  baseKm: number;
  feePerKm: number;
  maxDistanceKm: number;
  freeThreshold: number;
  freeShipDistanceKm: number;
  weatherSurchargeActive: boolean;
  weatherSurchargeFee: number;
  weatherAutoMode: boolean;
  weatherRainTiersJson: WeatherTier[];
  weatherWindTiersJson: WeatherTier[];
  weatherThunderstormFee: number;
  weatherStaleMinutes: number;
  weatherAutoFee: number;
  weatherLabel: string | null;
  weatherSnapshotJson: WeatherSnapshot | null;
  weatherCheckedAt: string | null;
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
  weatherSurchargeActive?: boolean;
  weatherSurchargeFee?: number;
  weatherAutoMode?: boolean;
  weatherRainTiersJson?: WeatherTier[];
  weatherWindTiersJson?: WeatherTier[];
  weatherThunderstormFee?: number;
  weatherStaleMinutes?: number;
}

export async function fetchShippingConfig(): Promise<ShippingConfig> {
  const { data } = await api.get<ShippingConfig>("/admin/shipping/config");
  return data;
}

export async function updateShippingConfig(body: UpdateShippingConfigBody): Promise<ShippingConfig> {
  const { data } = await api.put<ShippingConfig>("/admin/shipping/config", body);
  return data;
}

/** Gọi Open-Meteo ngay (chỉ có tác dụng khi bật chế độ tự động). */
export async function refreshShippingWeather(): Promise<ShippingConfig> {
  const { data } = await api.post<ShippingConfig>("/admin/shipping/weather/refresh");
  return data;
}