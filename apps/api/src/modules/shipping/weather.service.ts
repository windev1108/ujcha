import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
    computeWeatherFee,
  CurrentWeather,
  LOWER_STREAK_REQUIRED,
  SHIPPING_CONFIG_CACHE_KEY,
  toConfigView,
  WeatherSnapshot,
} from '../../helper/weather.utilt';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
/** Chống chạy trùng khi có nhiều instance BE: bỏ qua nếu vừa cập nhật trong 10 phút. */
const MIN_INTERVAL_MS = 10 * 60_000;

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Dữ liệu `current` của Open-Meteo cập nhật mỗi 15 phút → poll 15 phút = 96 calls/ngày (limit 10.000). */
  @Cron('*/15 * * * *', { name: 'weather-surcharge-refresh' })
  async handleCron() {
    try {
      await this.refresh(false);
    } catch (err) {
      this.logger.error(`Weather refresh failed: ${(err as Error).message}`);
    }
  }

  /**
   * @param force true = admin bấm "Cập nhật ngay" (bỏ qua guard 10 phút).
   * Chỉ chạy khi bật phụ phí + chế độ tự động.
   */
  async refresh(force = false) {
    const row = await this.prisma.shippingConfig.findUnique({
      where: { id: 'default' },
    });
    if (!row || !row.weatherSurchargeActive || !row.weatherAutoMode)
      return { skipped: 'auto-disabled' };

    if (
      !force &&
      row.weatherCheckedAt &&
      Date.now() - row.weatherCheckedAt.getTime() < MIN_INTERVAL_MS
    ) {
      return { skipped: 'recently-checked' };
    }

    const store = await this.prisma.storeLocation.findFirst();
    if (!store || (store.lat === 0 && store.lng === 0)) {
      this.logger.warn(
        'Store location chưa cấu hình — bỏ qua tracking thời tiết.',
      );
      return { skipped: 'no-store-location' };
    }

    // Chỉ 1 điểm theo dõi: toạ độ quán. maxDistanceKm (~10km) nằm trong cùng một ô lưới
    // của model thời tiết (~2–11km) nên không cần gọi theo từng địa chỉ khách.
    const weather = await this.fetchCurrent(store.lat, store.lng);

    const cfg = toConfigView(row);
    const next = computeWeatherFee(
      weather,
      cfg.weatherRainTiersJson,
      cfg.weatherWindTiersJson,
      cfg.weatherThunderstormFee,
    );

    // Hysteresis: tăng ngay, hạ chỉ sau LOWER_STREAK_REQUIRED lần đọc liên tiếp thấp hơn.
    const prevFresh =
      cfg.weatherCheckedAt &&
      Date.now() - cfg.weatherCheckedAt.getTime() <=
        cfg.weatherStaleMinutes * 60_000;
    let appliedFee = next.fee;
    let appliedLabel = next.label;
    let streak = 0;
    if (prevFresh && next.fee < cfg.weatherAutoFee) {
      streak = cfg.weatherLowerStreak + 1;
      if (streak < LOWER_STREAK_REQUIRED) {
        appliedFee = cfg.weatherAutoFee;
        appliedLabel = cfg.weatherLabel;
      } else {
        streak = 0;
      }
    }

    const snapshot: WeatherSnapshot = {
      precipitation: weather.precipitation,
      windSpeed: weather.windSpeed,
      windGusts: weather.windGusts,
      weatherCode: weather.weatherCode,
      fetchedAt: new Date().toISOString(),
      rainFee: next.rainFee,
      windFee: next.windFee,
      thunderstormFee: next.thunderFee,
      reason: next.label,
    };

    await this.prisma.shippingConfig.update({
      where: { id: 'default' },
      data: {
        weatherAutoFee: appliedFee,
        weatherLabel: appliedLabel,
        weatherLowerStreak: streak,
        weatherSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        weatherCheckedAt: new Date(),
      },
    });
    await this.redis.del(SHIPPING_CONFIG_CACHE_KEY);

    this.logger.log(
      `Weather surcharge → ${appliedFee}đ (${appliedLabel ?? 'không mưa/gió'})`,
    );
    return { fee: appliedFee, label: appliedLabel };
  }

  private async fetchCurrent(
    lat: number,
    lng: number,
  ): Promise<CurrentWeather> {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    // Dùng `precipitation` (rain + showers + snow), KHÔNG dùng riêng `rain`: mưa rào nhiệt đới
    // nằm ở `showers` nên chỉ lấy `rain` sẽ bỏ sót.
    url.searchParams.set(
      'current',
      'precipitation,weather_code,wind_speed_10m,wind_gusts_10m',
    );
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('timezone', 'auto');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const json = (await res.json()) as {
        current?: Record<string, number | string>;
      };
      const c = json.current;
      if (!c) throw new Error('Open-Meteo: thiếu field "current"');
      // `precipitation` trong `current` là tổng mm của khoảng `interval` (mặc định 900s = 15 phút)
      // → quy đổi ra mm/h để so với mốc mưa (chuẩn phân loại cường độ mưa tính theo mm/h).
      const intervalSec = Number(c.interval) > 0 ? Number(c.interval) : 900;
      const mmPerHour = (Number(c.precipitation ?? 0) * 3600) / intervalSec;
      return {
        precipitation: Math.round(mmPerHour * 100) / 100,
        windSpeed: Number(c.wind_speed_10m ?? 0),
        windGusts: Number(c.wind_gusts_10m ?? 0),
        weatherCode: Number(c.weather_code ?? 0),
        time: String(c.time ?? ''),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
