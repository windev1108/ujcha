import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateShippingConfigDto } from './dto/update-shipping-config.dto';
import {
  normalizeTiers,
  resolveWeatherSurcharge,
  SHIPPING_CONFIG_CACHE_KEY,
  ShippingConfigView,
  toConfigView,
} from '../../helper/weather.utilt';
import { RedisService } from '../redis/redis.service';
import { Prisma } from '@prisma/client';

export type ShippingEstimate = {
  distanceKm: number;
  fee: number;
  isFree: boolean;
  isOutOfRange: boolean;
  isDisabled: boolean;
  freeShipDistanceKm: number;
  weatherSurchargeActive: boolean;
  weatherSurchargeFee: number;
  weatherSurchargeLabel: string | null;
};

export type PublicShippingConfig = {
  isActive: boolean;
  baseFee: number;
  baseKm: number;
  feePerKm: number;
  maxDistanceKm: number;
  freeThreshold: number;
  freeShipDistanceKm: number;
  /** Trạng thái phụ phí đang áp dụng thực tế (manual hoặc auto). */
  weatherSurchargeActive: boolean;
  weatherSurchargeFee: number;
  weatherSurchargeLabel: string | null;
};

const CONFIG_CACHE_TTL_S = 60;
@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  async getConfig(): Promise<ShippingConfigView> {
    const cached = await this.redis.get<Parameters<typeof toConfigView>[0]>(
      SHIPPING_CONFIG_CACHE_KEY,
    );
    if (cached) return toConfigView(cached);

    const row = await this.prisma.shippingConfig.upsert({
      where: { id: 'default' },
      create: {},
      update: {},
    });
    await this.redis.set(SHIPPING_CONFIG_CACHE_KEY, row, CONFIG_CACHE_TTL_S);
    return toConfigView(row);
  }

  async getPublicConfig(): Promise<PublicShippingConfig> {
    const cfg = await this.getConfig();
    const weather = resolveWeatherSurcharge(cfg);
    return {
      isActive: cfg.isActive,
      baseFee: cfg.baseFee,
      baseKm: cfg.baseKm,
      feePerKm: cfg.feePerKm,
      maxDistanceKm: cfg.maxDistanceKm,
      freeThreshold: cfg.freeThreshold,
      freeShipDistanceKm: cfg.freeShipDistanceKm,
      weatherSurchargeActive: weather.active,
      weatherSurchargeFee: weather.fee,
      weatherSurchargeLabel: weather.label,
    };
  }

  async updateConfig(
    dto: UpdateShippingConfigDto,
  ): Promise<ShippingConfigView> {
    const { weatherRainTiersJson, weatherWindTiersJson, ...rest } = dto;
    const data = {
      ...rest,
      ...(weatherRainTiersJson && {
        weatherRainTiersJson: normalizeTiers(
          weatherRainTiersJson,
          [],
        ) as unknown as Prisma.InputJsonValue,
      }),
      ...(weatherWindTiersJson && {
        weatherWindTiersJson: normalizeTiers(
          weatherWindTiersJson,
          [],
        ) as unknown as Prisma.InputJsonValue,
      }),
    };

    const row = await this.prisma.shippingConfig.upsert({
      where: { id: 'default' },
      create: data,
      update: data,
    });
    await this.redis.del(SHIPPING_CONFIG_CACHE_KEY);
    return toConfigView(row);
  }

  /** Haversine distance in km between two coordinates. */
  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async estimateFee(
    lat: number,
    lng: number,
    orderAmount = 0,
  ): Promise<ShippingEstimate> {
    const [cfg, store] = await Promise.all([
      this.getConfig(),
      this.prisma.storeLocation.findFirst(),
    ]);

    const weather = resolveWeatherSurcharge(cfg);

    // Không giao được (tắt / chưa có toạ độ quán / ngoài bán kính) → không có phụ phí thời tiết.
    const notDeliverable = (
      extra: Partial<ShippingEstimate>,
    ): ShippingEstimate => ({
      distanceKm: 0,
      fee: 0,
      isFree: false,
      isOutOfRange: false,
      isDisabled: false,
      freeShipDistanceKm: cfg.freeShipDistanceKm,
      weatherSurchargeActive: false,
      weatherSurchargeFee: 0,
      weatherSurchargeLabel: null,
      ...extra,
    });

    if (!cfg.isActive) return notDeliverable({ isDisabled: true });

    const storeLat = store?.lat ?? 0;
    const storeLng = store?.lng ?? 0;
    if (storeLat === 0 && storeLng === 0)
      return notDeliverable({ isDisabled: true });

    const distanceKm = this.haversineKm(lat, lng, storeLat, storeLng);

    // Chỉ tracking/áp phụ phí trong bán kính giao hàng (maxDistanceKm).
    if (distanceKm > cfg.maxDistanceKm)
      return notDeliverable({ distanceKm, isOutOfRange: true });

    const extraKm = Math.max(0, distanceKm - cfg.baseKm);
    const rawFee = cfg.baseFee + Math.round(extraKm) * cfg.feePerKm;
    const isFreeByAmount =
      cfg.freeThreshold > 0 && orderAmount >= cfg.freeThreshold;
    const isFreeByDistance =
      cfg.freeShipDistanceKm > 0 && distanceKm <= cfg.freeShipDistanceKm;
    const isFree = isFreeByAmount || isFreeByDistance;

    // Phụ phí thời tiết cộng thêm bất kể freeship (giữ nguyên hành vi cũ).
    // Muốn freeship miễn luôn: isFree ? 0 : weather.fee
    const fee = (isFree ? 0 : rawFee) + weather.fee;

    return {
      distanceKm,
      fee,
      isFree,
      isOutOfRange: false,
      isDisabled: false,
      freeShipDistanceKm: cfg.freeShipDistanceKm,
      weatherSurchargeActive: weather.active,
      weatherSurchargeFee: weather.fee,
      weatherSurchargeLabel: weather.label,
    };
  }
}
