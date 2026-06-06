import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  PointSource,
  PointTransactionType,
  ReferralRewardStatus,
} from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { PointService } from '../point/point.service';
import { PrismaService } from '../prisma/prisma.service';

export type ReferralProcessResult =
  | { status: 'skipped'; reason: string }
  | { status: 'credited'; referralRewardId: string };

@Injectable()
export class ReferralRewardProcessingService {
  private readonly logger = new Logger(ReferralRewardProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
    private readonly notificationService: NotificationService,
  ) { }

  async tryProcessReferralOnOrderCompleted(
    orderId: string,
  ): Promise<ReferralProcessResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.completed) {
      return { status: 'skipped', reason: 'order_not_completed' };
    }

    const cfg = await this.prisma.referralProgramConfig.findFirst({
      where: { isActive: true },
    });
    if (!cfg) return { status: 'skipped', reason: 'no_referral_config' };

    if (order.finalAmount.lessThan(cfg.minOrderAmount)) {
      return { status: 'skipped', reason: 'below_min_order_amount' };
    }

    if (!order.userId) return { status: 'skipped', reason: 'no_user_on_order' };

    const b = await this.prisma.user.findUnique({ where: { id: order.userId } });
    if (!b || !b.referredBy || !b.phone || !b.phoneVerifiedAt) {
      return { status: 'skipped', reason: 'no_referral_or_phone' };
    }

    const creditedBefore = await this.prisma.referralReward.findFirst({
      where: { referredUserId: b.id, status: ReferralRewardStatus.credited },
      select: { id: true },
    });
    if (creditedBefore) return { status: 'skipped', reason: 'already_rewarded_referred_user' };

    const a = await this.prisma.user.findFirst({ where: { referralCode: b.referredBy } });
    if (!a || a.id === b.id) return { status: 'skipped', reason: 'referrer_not_found' };

    if (cfg.blockSameIpAsReferrer && b.registrationIp && a.registrationIp) {
      if (b.registrationIp === a.registrationIp) return { status: 'skipped', reason: 'fraud_same_ip' };
    }
    if (cfg.blockSameDeviceAsReferrer && b.registrationDeviceId && a.registrationDeviceId) {
      if (b.registrationDeviceId === a.registrationDeviceId) return { status: 'skipped', reason: 'fraud_same_device' };
    }

    const startUtc = new Date();
    startUtc.setUTCHours(0, 0, 0, 0);
    const rewardsToday = await this.prisma.referralReward.count({
      where: { beneficiaryId: a.id, status: ReferralRewardStatus.credited, createdAt: { gte: startUtc } },
    });
    if (rewardsToday >= cfg.maxReferrerRewardsPerDay) {
      return { status: 'skipped', reason: 'referrer_daily_limit' };
    }

    const dupEarn = await this.prisma.pointTransaction.findFirst({
      where: {
        userId: a.id,
        type: PointTransactionType.earn,
        source: PointSource.referral,
        referenceId: orderId,
      },
      select: { id: true },
    });
    if (dupEarn) return { status: 'skipped', reason: 'idempotent_points' };

    const pointConfig = await this.prisma.pointConfig.findFirst({
      where: { isActive: true },
      select: { pointRate: true },
    });
    const pointRate = pointConfig?.pointRate ?? 1000;

    const commissionPoints = Math.max(
      1,
      Math.round(order.finalAmount.toNumber() * cfg.referrerCommissionPercent / 100 / pointRate),
    );

    try {
      const referralRewardId = await this.prisma.$transaction(async (tx) => {
        await this.pointService.earnPointsTx(
          tx,
          a.id,
          commissionPoints,
          PointSource.referral,
          orderId,
          { expiresAt: null, usableFrom: null },
        );

        const reward = await tx.referralReward.create({
          data: {
            beneficiaryId: a.id,
            referredUserId: b.id,
            amount: order.finalAmount,
            status: ReferralRewardStatus.credited,
            orderId: order.id,
            referrerPointsGranted: commissionPoints,
            note: `Commission ${cfg.referrerCommissionPercent}% on order ${orderId}`,
          },
        });

        return reward.id;
      });

      this.logger.log(
        `Referral commission ${commissionPoints}pts (${cfg.referrerCommissionPercent}%) credited to ${a.id} for order ${orderId}`,
      );

      const referredName = b.name?.trim() || 'bạn bè';
      void this.notificationService.createAndEmit({
        userId: a.id,
        type: 'reward',
        title: 'Nhận điểm hoa hồng',
        content: `Bạn vừa nhận ${commissionPoints} điểm hoa hồng từ ${referredName} đặt đơn đầu tiên!`,
        data: {
          notifKey: 'referral_commission',
          points: commissionPoints,
          referredUserName: referredName,
        },
      });

      return { status: 'credited', referralRewardId };
    } catch (err) {
      this.logger.error(
        `Referral reward failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
      );
      return { status: 'skipped', reason: 'transaction_failed' };
    }
  }
}
