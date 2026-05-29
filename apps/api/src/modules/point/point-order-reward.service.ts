import { Injectable, Logger } from '@nestjs/common';
import {
  GroupPaymentMode,
  OrderStatus,
  PointSource,
  PointTransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PointPolicyService, type ResolvedPointPolicy } from './point-policy.service';
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
   *
   * Với đơn nhóm split (mỗi người tự trả), tính điểm theo phần tiền từng người
   * thay vì tổng đơn. Với đơn thường hoặc host_pays, tính theo finalAmount toàn đơn.
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

    const policy = await this.pointPolicy.resolve(new Date());
    if (!policy) {
      return;
    }

    // Chỉ tích điểm trên giá trị sản phẩm, không bao gồm phí vận chuyển
    const productAmount = order.totalAmount
      .sub(order.discountAmount)
      .sub(order.pointDiscountAmount ?? new Prisma.Decimal(0));

    // Kiểm tra có phải group order split không
    const groupOrder = await this.prisma.groupOrder.findFirst({
      where: { orderId, paymentMode: GroupPaymentMode.split },
      include: {
        participants: {
          where: { userId: { not: null } },
          include: { items: true },
        },
      },
    });

    if (groupOrder && groupOrder.participants.length > 0) {
      await this.rewardSplitGroupOrder(
        { id: order.id, productAmount, updatedAt: order.updatedAt },
        groupOrder.participants,
        policy,
      );
      return;
    }

    // Đơn thường hoặc group order host_pays: tích điểm theo giá trị sản phẩm
    await this.rewardForAmount(order.userId, orderId, productAmount, order.updatedAt, policy);
  }

  /**
   * Với split payment: mỗi participant có userId được tích điểm theo phần sản phẩm của họ.
   * Proportional share = (subtotal_của_họ / tổng_subtotal) × productAmount (không gồm phí ship).
   */
  private async rewardSplitGroupOrder(
    order: { id: string; productAmount: Prisma.Decimal; updatedAt: Date },
    participants: Array<{
      userId: string | null;
      items: Array<{ unitPrice: Prisma.Decimal; quantity: number; toppingsJson: unknown }>;
    }>,
    policy: ResolvedPointPolicy,
  ): Promise<void> {
    let totalSubtotal = new Prisma.Decimal(0);
    const userSubtotals: Array<{ userId: string; subtotal: Prisma.Decimal }> = [];

    for (const participant of participants) {
      if (!participant.userId) continue;
      let sub = new Prisma.Decimal(0);
      for (const item of participant.items) {
        const toppingSum = Array.isArray(item.toppingsJson)
          ? (item.toppingsJson as Array<{ price?: number }>).reduce(
              (s, t) => s + Number(t.price ?? 0),
              0,
            )
          : 0;
        const unit = new Prisma.Decimal(item.unitPrice).add(new Prisma.Decimal(toppingSum));
        sub = sub.add(unit.mul(item.quantity));
      }
      if (sub.greaterThan(0)) {
        userSubtotals.push({ userId: participant.userId, subtotal: sub });
        totalSubtotal = totalSubtotal.add(sub);
      }
    }

    if (totalSubtotal.isZero()) return;

    for (const { userId, subtotal } of userSubtotals) {
      // Phần tích điểm theo tỉ lệ giá trị sản phẩm, không bao gồm phí ship
      const proportionalAmount = subtotal
        .mul(order.productAmount)
        .div(totalSubtotal)
        .toDecimalPlaces(0);
      await this.rewardForAmount(userId, order.id, proportionalAmount, order.updatedAt, policy);
    }
  }

  /**
   * Tích điểm cho một user dựa trên amount, idempotent theo (userId, orderId).
   */
  private async rewardForAmount(
    userId: string,
    orderId: string,
    amount: Prisma.Decimal,
    updatedAt: Date,
    policy: ResolvedPointPolicy,
  ): Promise<void> {
    const already = await this.prisma.pointTransaction.findFirst({
      where: {
        userId,
        type: PointTransactionType.earn,
        source: PointSource.order,
        referenceId: orderId,
      },
      select: { id: true },
    });
    if (already) return;

    if (amount.lessThan(policy.minOrderAmount)) return;

    const earnedDecimal = amount
      .mul(policy.effectiveEarnPercent)
      .div(100)
      .div(policy.pointRate);
    const points = Math.round(Number(earnedDecimal.toString()) * 10) / 10;
    if (points < 0.1) return;

    const baseMs = updatedAt.getTime();
    const usableFrom = new Date(baseMs + policy.delayHours * 60 * 60 * 1000);
    const expiresAt =
      policy.expireDays > 0
        ? new Date(baseMs + policy.expireDays * 24 * 60 * 60 * 1000)
        : null;

    try {
      await this.pointService.earnPoints(
        userId,
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
        `Point earn failed for user ${userId} order ${orderId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
