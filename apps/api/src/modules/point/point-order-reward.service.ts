import { Injectable, Logger } from '@nestjs/common';
import {
  OrderStatus,
  PointSource,
  PointTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PointPolicyService } from './point-policy.service';
import { PointService } from './point.service';

@Injectable()
export class PointOrderRewardService {
  private readonly logger = new Logger(PointOrderRewardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointPolicy: PointPolicyService,
    private readonly pointService: PointService,
  ) { }

  /**
   * Gọi sau khi đơn chuyển sang `completed`: tích điểm một lần / đơn (idempotent).
   */
  async tryRewardOrderCompletion(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.status !== OrderStatus.completed) {
      return;
    }

    if (!order.userId) {
      return;
    }

    const already = await this.prisma.pointTransaction.findFirst({
      where: {
        type: PointTransactionType.earn,
        source: PointSource.order,
        referenceId: orderId,
      },
      select: { id: true },
    });
    if (already) {
      return;
    }

    const policy = await this.pointPolicy.resolve(new Date());
    if (!policy) {
      return;
    }

    if (order.finalAmount.lessThan(policy.minOrderAmount)) {
      return;
    }

    const earnedDecimal = order.finalAmount
      .mul(policy.effectiveEarnPercent)
      .div(100)
      .div(policy.pointRate);
    const points = Math.round(Number(earnedDecimal.toString()) * 10) / 10;
    if (points < 0.1) {
      return;
    }

    const baseMs = order.updatedAt.getTime();
    const usableFrom = new Date(
      baseMs + policy.delayHours * 60 * 60 * 1000,
    );
    const expiresAt =
      policy.expireDays > 0
        ? new Date(baseMs + policy.expireDays * 24 * 60 * 60 * 1000)
        : null;

    try {
      await this.pointService.earnPoints(
        order.userId,
        points,
        PointSource.order,
        orderId,
        {
          expiresAt,
          usableFrom: policy.delayHours > 0 ? usableFrom : null,
        },
      );
    } catch (err) {
      this.logger.error(
        `Point earn failed for order ${orderId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
