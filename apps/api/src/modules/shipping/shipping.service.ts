import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateShippingConfigDto } from './dto/update-shipping-config.dto';

export type ShippingEstimate = {
  distanceKm: number;
  fee: number;
  isFree: boolean;
  isOutOfRange: boolean;
  isDisabled: boolean;
};

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    return this.prisma.shippingConfig.upsert({
      where: { id: 'default' },
      create: {},
      update: {},
    });
  }

  async updateConfig(dto: UpdateShippingConfigDto) {
    return this.prisma.shippingConfig.upsert({
      where: { id: 'default' },
      create: { ...dto },
      update: { ...dto },
    });
  }

  /** Haversine distance in km between two coordinates. */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async estimateFee(lat: number, lng: number, orderAmount = 0): Promise<ShippingEstimate> {
    const [cfg, store] = await Promise.all([
      this.getConfig(),
      this.prisma.storeLocation.findFirst(),
    ]);

    if (!cfg.isActive) {
      return { distanceKm: 0, fee: 0, isFree: false, isOutOfRange: false, isDisabled: true };
    }

    const storeLat = store?.lat ?? 0;
    const storeLng = store?.lng ?? 0;

    if (storeLat === 0 && storeLng === 0) {
      return { distanceKm: 0, fee: 0, isFree: false, isOutOfRange: false, isDisabled: true };
    }

    const distanceKm = this.haversineKm(lat, lng, storeLat, storeLng);

    if (distanceKm > cfg.maxDistanceKm) {
      return { distanceKm, fee: 0, isFree: false, isOutOfRange: true, isDisabled: false };
    }

    const extraKm = Math.max(0, distanceKm - cfg.baseKm);
    const rawFee = cfg.baseFee + Math.ceil(extraKm) * cfg.feePerKm;
    const isFree = cfg.freeThreshold > 0 && orderAmount >= cfg.freeThreshold;

    return {
      distanceKm,
      fee: isFree ? 0 : rawFee,
      isFree,
      isOutOfRange: false,
      isDisabled: false,
    };
  }
}
