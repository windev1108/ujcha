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
        participants: { include: { items: true } },
      },
    });

    if (groupOrder && groupOrder.participants.some((p) => p.items.length > 0)) {
      await this.rewardSplitGroupOrder(
        { id: order.id, productAmount, updatedAt: order.updatedAt },
        groupOrder.participants,
        groupOrder.hostUserId,
        policy,
      );
      return;
    }

    // Đơn thường hoặc group order host_pays: tích điểm theo giá trị sản phẩm
    await this.rewardForAmount(order.userId, orderId, productAmount, order.updatedAt, policy);
  }

  /**
   * Với split payment: participant đã đăng nhập tích điểm theo phần của họ.
   * Participant guest (userId = null) → phần điểm của họ gộp vào chủ nhóm (hostUserId).
   */
  private async rewardSplitGroupOrder(
    order: { id: string; productAmount: Prisma.Decimal; updatedAt: Date },
    participants: Array<{
      userId: string | null;
      items: Array<{ unitPrice: Prisma.Decimal; quantity: number; toppingsJson: unknown }>;
    }>,
    hostUserId: string,
    policy: ResolvedPointPolicy,
  ): Promise<void> {
    let totalSubtotal = new Prisma.Decimal(0);
    const userSubtotals = new Map<string, Prisma.Decimal>();

    for (const participant of participants) {
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
      if (sub.isZero()) continue;

      // Guest participant → điểm gộp vào chủ nhóm
      const recipientId = participant.userId ?? hostUserId;
      userSubtotals.set(recipientId, (userSubtotals.get(recipientId) ?? new Prisma.Decimal(0)).add(sub));
      totalSubtotal = totalSubtotal.add(sub);
    }

    if (totalSubtotal.isZero()) return;

    for (const [userId, subtotal] of userSubtotals) {
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
    const points = Math.floor(Number(earnedDecimal.toString()));
    if (points < 1) return;

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
