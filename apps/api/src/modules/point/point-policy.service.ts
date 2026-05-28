import { Injectable } from '@nestjs/common';
import { Prisma, type PointConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Giá trị dùng khi tích điểm từ đơn (campaign override earnPercent). */
export type ResolvedPointPolicy = {
  effectiveEarnPercent: Prisma.Decimal;
  earnPercentSource: 'config' | 'campaign';
  /** 1 điểm = pointRate đồng (vd. 100 → cần 100đ để được 1 điểm). */
  pointRate: number;
  delayHours: number;
  expireDays: number;
  minOrderAmount: Prisma.Decimal;
};

@Injectable()
export class PointPolicyService {
  constructor(private readonly prisma: PrismaService) { }

  /** Config đang active (dùng cho đổi điểm trên đơn — không gộp campaign). */
  async getActiveConfigRaw(): Promise<PointConfig | null> {
    return this.prisma.pointConfig.findFirst({
      where: { isActive: true },
    });
  }

  /**
   * Config đang active + campaign trong khung giờ (nếu có) → earnPercent hiệu dụng.
   */
  async resolve(now: Date): Promise<ResolvedPointPolicy | null> {
    const config = await this.prisma.pointConfig.findFirst({
      where: { isActive: true },
    });
    if (!config) {
      return null;
    }

    const campaigns = await this.prisma.pointCampaign.findMany({
      where: {
        isActive: true,
        startAt: { lte: now },
        endAt: { gte: now },
      },
      orderBy: [{ earnPercent: 'desc' }, { createdAt: 'desc' }],
    });

    const activeCampaign = campaigns[0] ?? null;
    const effectiveEarnPercent = activeCampaign
      ? activeCampaign.earnPercent
      : config.earnPercent;

    return {
      effectiveEarnPercent,
      earnPercentSource: activeCampaign ? 'campaign' : 'config',
      pointRate: config.pointRate,
      delayHours: config.delayHours,
      expireDays: config.expireDays,
      minOrderAmount: config.minOrderAmount,
    };
  }
}
