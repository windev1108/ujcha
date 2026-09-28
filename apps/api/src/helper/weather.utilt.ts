import type { ShippingConfig } from '@prisma/client';

export const SHIPPING_CONFIG_CACHE_KEY = 'shipping:config';
export const THUNDERSTORM_CODES = [95, 96, 99];
/** Số lần đọc liên tiếp thấp hơn mới hạ phụ phí (tránh nhảy bật/tắt quanh ngưỡng). */
export const LOWER_STREAK_REQUIRED = 2;

export type WeatherTier = { label: string; minValue: number; fee: number };

export type CurrentWeather = {
  precipitation: number; // mm/h (đã quy đổi từ tổng mm của interval 15 phút)
  windSpeed: number; // km/h
  windGusts: number; // km/h
  weatherCode: number;
  time: string;
};

export type WeatherSnapshot = {
  precipitation: number;
  windSpeed: number;
  windGusts: number;
  weatherCode: number;
  fetchedAt: string;
  rainFee: number;
  windFee: number;
  thunderstormFee: number;
  reason: string | null;
};

// Mưa (mm/h). Dữ liệu 15 phút có độ phân giải 0.1mm ≈ 0.4 mm/h, nên mốc đầu 0.5 mm/h
// bỏ qua mưa phùn thoáng qua (0.1mm/15 phút) và bắt đầu tính từ 0.2mm/15 phút trở lên.
// Mốc thấp nhất = 4.000đ như mức mặc định hiện tại.
export const DEFAULT_RAIN_TIERS: WeatherTier[] = [
  { label: 'Mưa nhỏ', minValue: 0.5, fee: 4000 },
  { label: 'Mưa vừa', minValue: 2.5, fee: 6000 },
  { label: 'Mưa to', minValue: 7.6, fee: 8000 },
  { label: 'Mưa rất to', minValue: 15, fee: 10000 },
];

// Gió giật (km/h).
export const DEFAULT_WIND_TIERS: WeatherTier[] = [
  { label: 'Gió mạnh', minValue: 40, fee: 4000 },
  { label: 'Gió rất mạnh', minValue: 62, fee: 6000 },
  { label: 'Bão / gió giật cấp bão', minValue: 89, fee: 10000 },
];

/** null / không phải mảng → mặc định; mảng rỗng → admin chủ động không dùng mốc nào. */
export function normalizeTiers(
  raw: unknown,
  fallback: WeatherTier[],
): WeatherTier[] {
  if (!Array.isArray(raw)) return fallback;
  return raw
    .map((r) => ({
      label: String(r?.label ?? '').trim() || 'Mức',
      minValue: Number(r?.minValue),
      fee: Math.round(Number(r?.fee)),
    }))
    .filter(
      (t) =>
        Number.isFinite(t.minValue) &&
        t.minValue > 0 &&
        Number.isFinite(t.fee) &&
        t.fee >= 0,
    )
    .sort((a, b) => a.minValue - b.minValue);
}

export function pickTier(
  tiers: WeatherTier[],
  value: number,
): WeatherTier | null {
  if (!Number.isFinite(value)) return null;
  let best: WeatherTier | null = null;
  for (const t of tiers) {
    if (value >= t.minValue && (!best || t.minValue > best.minValue)) best = t;
  }
  return best;
}

/** Lấy mức CAO NHẤT giữa mưa / gió / dông — không cộng dồn. */
export function computeWeatherFee(
  w: CurrentWeather,
  rainTiers: WeatherTier[],
  windTiers: WeatherTier[],
  thunderstormFee: number,
) {
  const rain = pickTier(rainTiers, w.precipitation);
  const wind = pickTier(windTiers, Math.max(w.windGusts, w.windSpeed));
  const thunder = THUNDERSTORM_CODES.includes(w.weatherCode)
    ? thunderstormFee
    : 0;

  const candidates = [
    { fee: rain?.fee ?? 0, label: rain?.label ?? null },
    { fee: wind?.fee ?? 0, label: wind?.label ?? null },
    { fee: thunder, label: 'Dông' },
  ];
  const top = candidates.reduce((a, b) => (b.fee > a.fee ? b : a));

  return {
    fee: top.fee,
    label: top.fee > 0 ? top.label : null,
    rainFee: rain?.fee ?? 0,
    windFee: wind?.fee ?? 0,
    thunderFee: thunder,
  };
}

export type ShippingConfigView = Omit<
  ShippingConfig,
  'weatherRainTiersJson' | 'weatherWindTiersJson' | 'weatherCheckedAt'
> & {
  weatherRainTiersJson: WeatherTier[];
  weatherWindTiersJson: WeatherTier[];
  weatherCheckedAt: Date | null;
};

/** Chuẩn hoá row DB (hoặc row lấy từ Redis, Date đã thành string). */
export function toConfigView(row: ShippingConfig): ShippingConfigView {
  return {
    ...row,
    weatherRainTiersJson: normalizeTiers(
      row.weatherRainTiersJson,
      DEFAULT_RAIN_TIERS,
    ),
    weatherWindTiersJson: normalizeTiers(
      row.weatherWindTiersJson,
      DEFAULT_WIND_TIERS,
    ),
    weatherCheckedAt: row.weatherCheckedAt
      ? new Date(row.weatherCheckedAt)
      : null,
  };
}

/** Phụ phí thời tiết THỰC SỰ áp dụng lúc này (manual hoặc auto). */
export function resolveWeatherSurcharge(
  cfg: ShippingConfigView,
  now = Date.now(),
) {
  if (!cfg.weatherSurchargeActive)
    return { active: false, fee: 0, label: null as string | null };

  if (!cfg.weatherAutoMode) {
    const fee = cfg.weatherSurchargeFee;
    return { active: fee > 0, fee, label: fee > 0 ? 'Thời tiết xấu' : null };
  }

  // Auto: bỏ qua nếu dữ liệu quá cũ (API/cron lỗi) — không tính oan cho khách.
  const checkedAt = cfg.weatherCheckedAt?.getTime() ?? 0;
  const isStale = now - checkedAt > cfg.weatherStaleMinutes * 60_000;
  if (isStale || cfg.weatherAutoFee <= 0)
    return { active: false, fee: 0, label: null };
  return {
    active: true,
    fee: cfg.weatherAutoFee,
    label: cfg.weatherLabel ?? 'Thời tiết xấu',
  };
}
