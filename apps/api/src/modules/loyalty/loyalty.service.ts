import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, PointSource, PointTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PointPolicyService } from '../point/point-policy.service';
import { PointService } from '../point/point.service';

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointPolicy: PointPolicyService,
    private readonly pointService: PointService,
  ) {}

  async getOrderInfo(paymentCode: string) {
    const order = await this.prisma.order.findUnique({
      where: { paymentCode },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        finalAmount: true,
        paymentCode: true,
        type: true,
        createdAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException({ message: 'Không tìm thấy đơn hàng.', code: 'ORDER_NOT_FOUND' });
    }

    const alreadyClaimed = await this.prisma.pointTransaction.findFirst({
      where: {
        type: PointTransactionType.earn,
        source: PointSource.order,
        referenceId: order.id,
      },
      select: { id: true },
    });

    const policy = await this.pointPolicy.resolve(new Date());
    let potentialPoints = 0;
    if (policy && !alreadyClaimed) {
      const earned = order.finalAmount
        .mul(policy.effectiveEarnPercent)
        .div(100)
        .div(policy.pointRate);
      potentialPoints = Math.max(0, Math.round(Number(earned.toString()) * 10) / 10);
    }

    const isEligible =
      order.status === OrderStatus.completed &&
      order.paymentStatus === PaymentStatus.paid &&
      !alreadyClaimed &&
      potentialPoints >= 0.1;

    return {
      paymentCode: order.paymentCode,
      status: order.status,
      paymentStatus: order.paymentStatus,
      finalAmount: order.finalAmount.toString(),
      type: order.type,
      createdAt: order.createdAt,
      isEligible,
      alreadyClaimed: !!alreadyClaimed,
      potentialPoints,
    };
  }

  async claimPoints(paymentCode: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { paymentCode } });
    if (!order) {
      throw new NotFoundException({ message: 'Không tìm thấy đơn hàng.', code: 'ORDER_NOT_FOUND' });
    }
    if (order.status !== OrderStatus.completed) {
      throw new BadRequestException({ message: 'Đơn chưa hoàn thành.', code: 'ORDER_NOT_COMPLETED' });
    }
    if (order.paymentStatus !== PaymentStatus.paid) {
      throw new BadRequestException({ message: 'Đơn chưa thanh toán.', code: 'ORDER_NOT_PAID' });
    }

    const already = await this.prisma.pointTransaction.findFirst({
      where: {
        type: PointTransactionType.earn,
        source: PointSource.order,
        referenceId: order.id,
      },
    });
    if (already) {
      throw new BadRequestException({ message: 'Điểm đã được tích cho đơn này rồi.', code: 'POINTS_ALREADY_CLAIMED' });
    }

    const policy = await this.pointPolicy.resolve(new Date());
    if (!policy) {
      throw new BadRequestException({ message: 'Chưa có chính sách tích điểm.', code: 'NO_POINT_POLICY' });
    }
    if (order.finalAmount.lessThan(policy.minOrderAmount)) {
      throw new BadRequestException({ message: 'Đơn không đủ điều kiện tích điểm.', code: 'ORDER_BELOW_MINIMUM' });
    }

    const earned = order.finalAmount
      .mul(policy.effectiveEarnPercent)
      .div(100)
      .div(policy.pointRate);
    const points = Math.round(Number(earned.toString()) * 10) / 10;
    if (points < 0.1) {
      throw new BadRequestException({ message: 'Điểm tích lũy quá nhỏ.', code: 'INSUFFICIENT_POINTS' });
    }

    const now = Date.now();
    const usableFrom = policy.delayHours > 0 ? new Date(now + policy.delayHours * 3_600_000) : null;
    const expiresAt = policy.expireDays > 0 ? new Date(now + policy.expireDays * 86_400_000) : null;

    await this.pointService.earnPoints(userId, points, PointSource.order, order.id, { expiresAt, usableFrom });

    return { points, userId };
  }

  async searchUsers(q: string) {
    const qx = q?.trim();
    if (!qx || qx.length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: qx, mode: 'insensitive' } },
          { phone: { contains: qx, mode: 'insensitive' } },
          { email: { contains: qx, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, phone: true, pointBalance: true },
    });
  }
}
