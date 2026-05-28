import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  PointSource,
  Prisma,
} from '@prisma/client';
import { PointPolicyService } from '../point/point-policy.service';
import { PointService } from '../point/point.service';
import { PrismaService } from '../prisma/prisma.service';

export type OrderPointComputation = {
  baseSubtotalBeforePoints: string;
  maxUsableMoney: string;
  moneyFromPoints: string;
  actualDiscountMoney: string;
  pointsToSpend: number;
  finalAmount: string;
  meetsMinOrderAmount: boolean;
};

@Injectable()
export class OrderPointApplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pointPolicy: PointPolicyService,
    private readonly pointService: PointService,
  ) { }

  async getPublicRedemptionConfig() {
    const config = await this.pointPolicy.getActiveConfigRaw();
    if (!config || !config.isActive) return null;
    return {
      pointRate: Number(config.pointRate),
      maxUsagePercent: Number(config.maxUsagePercent),
      minOrderAmount: Number(config.minOrderAmount),
    };
  }

  async preview(userId: string, orderId: string, pointToUse: number) {
    const order = await this.loadOrderForPoints(userId, orderId);
    const config = await this.pointPolicy.getActiveConfigRaw();
    if (!config) {
      throw new BadRequestException({
        message: 'Chưa có cấu hình điểm.',
        code: 'POINT_CONFIG_NO_ACTIVE',
      });
    }

    const computed = this.compute(order, config, pointToUse);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'USER_NOT_FOUND',
      });
    }

    return {
      ...computed,
      pointBalance: user.pointBalance,
      sufficientPoints: user.pointBalance >= computed.pointsToSpend,
    };
  }

  async apply(userId: string, orderId: string, pointToUse: number) {
    const order = await this.loadOrderForPoints(userId, orderId);
    const config = await this.pointPolicy.getActiveConfigRaw();
    if (!config) {
      throw new BadRequestException({
        message: 'Chưa có cấu hình điểm.',
        code: 'POINT_CONFIG_NO_ACTIVE',
      });
    }

    const computed = this.compute(order, config, pointToUse);

    if (!computed.meetsMinOrderAmount) {
      throw new BadRequestException({
        message: `Đơn chưa đạt giá trị tối thiểu để dùng điểm (${config.minOrderAmount.toString()}đ).`,
        code: 'ORDER_POINT_MIN_AMOUNT',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'Không tìm thấy user.',
        code: 'USER_NOT_FOUND',
      });
    }
    if (user.pointBalance < computed.pointsToSpend) {
      throw new BadRequestException({
        message: 'Không đủ điểm.',
        code: 'POINT_INSUFFICIENT',
      });
    }

    const pointDiscountAmount = new Prisma.Decimal(computed.actualDiscountMoney);
    const finalAmount = new Prisma.Decimal(computed.finalAmount);

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        pointDiscountAmount,
        pointsReserved: computed.pointsToSpend,
        finalAmount,
      },
      include: {
        items: { orderBy: { id: 'asc' } },
        address: true,
        table: true,
      },
    });
  }

  /**
   * Admin POS: apply point discount at order creation time (bypasses payment-status check).
   * If spendImmediately=true (order was created as paid), points are spent in the same tx.
   */
  async applyForAdminCreate(
    userId: string,
    orderId: string,
    pointToUse: number,
    spendImmediately: boolean,
  ): Promise<void> {
    if (pointToUse < 1) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) return;

    const config = await this.pointPolicy.getActiveConfigRaw();
    if (!config || !config.isActive) return;

    const computed = this.compute(order, config, pointToUse);
    if (!computed.meetsMinOrderAmount || computed.pointsToSpend < 1) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });
    if (!user || user.pointBalance < computed.pointsToSpend) return;

    const pointDiscountAmount = new Prisma.Decimal(computed.actualDiscountMoney);
    const finalAmount = new Prisma.Decimal(computed.finalAmount);

    if (spendImmediately) {
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { pointDiscountAmount, finalAmount, pointsConsumed: computed.pointsToSpend },
        });
        await this.pointService.spendPointsTx(tx, userId, computed.pointsToSpend, {
          source: PointSource.order,
          referenceId: orderId,
        });
      });
    } else {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { pointDiscountAmount, finalAmount, pointsReserved: computed.pointsToSpend },
      });
    }
  }

  private compute(
    order: {
      totalAmount: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      shippingFee: Prisma.Decimal;
    },
    config: { pointRate: number; maxUsagePercent: Prisma.Decimal; minOrderAmount: Prisma.Decimal },
    pointToUse: number,
  ): OrderPointComputation {
    const baseSubtotal = order.totalAmount.sub(order.discountAmount);
    const pointRate = new Prisma.Decimal(config.pointRate);
    const maxUsable = baseSubtotal.mul(config.maxUsagePercent).div(100);
    const moneyFromPoints = pointRate.mul(pointToUse);
    const capped = moneyFromPoints.lessThan(maxUsable)
      ? moneyFromPoints
      : maxUsable;
    const pointsToSpend = Math.floor(
      Number(capped.div(pointRate).toString()),
    );
    const actualDiscountMoney = pointRate.mul(pointsToSpend);
    const finalAmount = baseSubtotal.sub(actualDiscountMoney).add(order.shippingFee);

    const meetsMinOrderAmount = baseSubtotal.greaterThanOrEqualTo(
      config.minOrderAmount,
    );

    return {
      baseSubtotalBeforePoints: baseSubtotal.toString(),
      maxUsableMoney: maxUsable.toString(),
      moneyFromPoints: moneyFromPoints.toString(),
      actualDiscountMoney: actualDiscountMoney.toString(),
      pointsToSpend,
      finalAmount: finalAmount.toString(),
      meetsMinOrderAmount,
    };
  }

  private async loadOrderForPoints(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }
    if (order.status === OrderStatus.cancelled) {
      throw new BadRequestException({
        message: 'Đơn đã hủy, không áp dụng điểm.',
        code: 'ORDER_POINT_CANCELLED',
      });
    }
    if (order.paymentStatus !== PaymentStatus.pending) {
      throw new BadRequestException({
        message: 'Chỉ áp dụng điểm khi đơn chưa thanh toán.',
        code: 'ORDER_POINT_NOT_PENDING_PAYMENT',
      });
    }
    if (order.pointsConsumed > 0) {
      throw new BadRequestException({
        message: 'Điểm đã được trừ cho đơn này.',
        code: 'ORDER_POINT_ALREADY_CONSUMED',
      });
    }
    return order;
  }
}
