import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  PointSource,
  Prisma,
} from '@prisma/client';
import { PointOrderRewardService } from '../../point/point-order-reward.service';
import { PointService } from '../../point/point.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralRewardProcessingService } from '../../referral/referral-reward-processing.service';
import { OrderService } from '../../order/order.service';
import { OrdersGateway } from '../../events/orders.gateway';
import type { UpdateOrderStatusDto } from '../../order/dto/update-order-status.dto';
import type { AdminCreateOrderDto } from './dto/admin-create-order.dto';
import type { AdminOrderMetricsQueryDto } from './dto/admin-order-metrics-query.dto';
import type { AssignShipperDto } from './dto/assign-shipper.dto';
import type { AdminOrderListQueryDto } from './dto/admin-order-list-query.dto';
import type { BulkUpdateOrderStatusDto } from './dto/bulk-update-order-status.dto';

const VN_TZ = '+07:00';
function vnStartOfDay(d: string): Date { return new Date(`${d}T00:00:00${VN_TZ}`); }
function vnEndOfDay(d: string): Date { return new Date(`${d}T23:59:59.999${VN_TZ}`); }
function vnTodayStr(): string {
  const vnNow = new Date(Date.now() + 7 * 3600_000);
  const y = vnNow.getUTCFullYear();
  const m = String(vnNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnNow.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

const adminOrderInclude = {
  user: { select: { id: true, name: true, phone: true, email: true } },
  address: true,
  table: true,
  shipper: true,
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrls: true,
          price: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export type AdminOrderPayload = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

@Injectable()
export class AdminOrderService {
  private readonly logger = new Logger(AdminOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly pointOrderReward: PointOrderRewardService,
    private readonly pointService: PointService,
    private readonly referralRewardProcessing: ReferralRewardProcessingService,
    private readonly ordersGateway: OrdersGateway,
  ) { }

  async findAll(query: AdminOrderListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qx = query.q?.trim();

    const and: Prisma.OrderWhereInput[] = [];
    if (query.type !== undefined) and.push({ type: query.type });
    if (query.status !== undefined) and.push({ status: query.status });
    if (query.from || query.to) {
      and.push({
        createdAt: {
          ...(query.from ? { gte: vnStartOfDay(query.from) } : {}),
          ...(query.to ? { lte: vnEndOfDay(query.to) } : {}),
        },
      });
    }
    if (qx) {
      and.push({
        OR: [
          { paymentCode: { contains: qx, mode: 'insensitive' } },
          { guestDeliveryAddress: { contains: qx, mode: 'insensitive' } },
          { guestDeliveryPhone: { contains: qx, mode: 'insensitive' } },
          { guestDeliveryName: { contains: qx, mode: 'insensitive' } },
          { user: { name: { contains: qx, mode: 'insensitive' } } },
          { user: { phone: { contains: qx, mode: 'insensitive' } } },
          { user: { email: { contains: qx, mode: 'insensitive' } } },
          ...(isUuid(qx) ? [{ id: qx }] : []),
        ],
      });
    }

    if (query.unassignedShipper === true) {
      and.push({ type: OrderType.delivery });
      and.push({ shipperId: null });
      and.push({ status: { not: OrderStatus.cancelled } });
    }

    if (query.isExternal === true) {
      // External orders được nhận diện bởi guestDeliveryName bắt đầu bằng "["
      and.push({ guestDeliveryName: { startsWith: '[' } });
    }

    const where: Prisma.OrderWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: adminOrderInclude,
      }),
    ]);

    return {
      items: rows.map((o) => this.withTypeDisplay(o)),
      total,
      page,
      pageSize,
    };
  }

  async getStats(query: AdminOrderMetricsQueryDto) {
    const today = vnTodayStr();
    const start = query.from ? vnStartOfDay(query.from) : vnStartOfDay(today);
    const end = query.to ? vnEndOfDay(query.to) : vnEndOfDay(today);

    const [paidAgg, activeCount, completedCount, cancelledCount] =
      await this.prisma.$transaction([
        this.prisma.order.aggregate({
          where: {
            paymentStatus: PaymentStatus.paid,
            createdAt: { gte: start, lte: end },
          },
          _sum: { finalAmount: true },
          _count: true,
        }),
        this.prisma.order.count({
          where: {
            status: {
              in: [
                OrderStatus.pending,
                OrderStatus.confirmed,
                OrderStatus.preparing,
                OrderStatus.ready,
                OrderStatus.delivering,
              ],
            },
            createdAt: { gte: start, lte: end },
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.completed,
            createdAt: { gte: start, lte: end },
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.cancelled,
            createdAt: { gte: start, lte: end },
          },
        }),
      ]);

    const revenue = Number(paidAgg._sum.finalAmount ?? 0);
    const paidN = paidAgg._count;
    const avgOrderValue = paidN > 0 ? revenue / paidN : 0;
    const denom = completedCount + cancelledCount;
    const fulfillmentSuccessPercent =
      denom > 0 ? Math.round((completedCount / denom) * 1000) / 10 : 100;

    return {
      totalRevenue: revenue,
      activeOrders: activeCount,
      avgOrderValue,
      fulfillmentSuccessPercent,
      range: { from: start.toISOString(), to: end.toISOString() },
    };
  }

  /** Member tuỳ chọn; không tạo user ảo trong DB. */
  private async resolveOrderUserId(
    dto: AdminCreateOrderDto,
  ): Promise<string | null> {
    const raw = dto.userId?.trim();
    if (!raw) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: raw },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException({
        message: 'Không tìm thấy khách.',
        code: 'ORDER_USER_NOT_FOUND',
      });
    }
    return raw;
  }

  async createAsAdmin(dto: AdminCreateOrderDto, opts?: { skipOptionValidation?: boolean }) {
    const userId = await this.resolveOrderUserId(dto);
    const { userId: _omit, paymentStatus: initialPaymentStatus, ...rest } = dto;
    const created = await this.orderService.createOrder(userId, rest, {
      skipPickupLead: true,
      initialPaymentStatus,
      skipOptionValidation: opts?.skipOptionValidation,
    });

    const result = await this.findById(created.id);
    this.ordersGateway.emitOrderCreated({ orderId: result.id, type: result.type });
    return result;
  }

  async remove(orderId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { select: { id: true }, take: 1 },
      },
    });
    if (!o) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }
    if (o.payments.length > 0) {
      throw new BadRequestException({
        message: 'Đơn đã có giao dịch thanh toán, không xóa được.',
        code: 'ORDER_HAS_PAYMENTS',
      });
    }
    await this.prisma.order.delete({ where: { id: orderId } });
  }

  async findById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: adminOrderInclude,
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }
    return this.withTypeDisplay(order);
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    if (dto.status === undefined && dto.paymentStatus === undefined) {
      throw new BadRequestException({
        message: 'Cần ít nhất status hoặc paymentStatus.',
        code: 'ORDER_STATUS_UPDATE_EMPTY',
      });
    }

    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }

    const shouldRewardPoints =
      dto.status === OrderStatus.completed &&
      existing.status !== OrderStatus.completed;

    const shouldSpendPoints =
      dto.paymentStatus === PaymentStatus.paid &&
      existing.paymentStatus !== PaymentStatus.paid &&
      existing.pointsReserved > 0;

    if (shouldSpendPoints) {
      if (!existing.userId) {
        throw new BadRequestException({
          message:
            'Đơn không gắn tài khoản không thể trừ điểm đã giữ (pointsReserved).',
          code: 'ORDER_POINTS_REQUIRE_USER',
        });
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        await this.pointService.spendPointsTx(
          tx,
          existing.userId!,
          existing.pointsReserved,
          {
            source: PointSource.order,
            referenceId: orderId,
          },
        );
        return tx.order.update({
          where: { id: orderId },
          data: {
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.paymentStatus !== undefined && {
              paymentStatus: dto.paymentStatus,
            }),
            pointsConsumed: existing.pointsReserved,
            pointsReserved: 0,
          },
          include: adminOrderInclude,
        });
      });

      if (shouldRewardPoints) {
        void this.pointOrderReward
          .tryRewardOrderCompletion(updated.id)
          .catch((err: unknown) => {
            this.logger.error(err);
          });
      }

      if (dto.status !== undefined) {
        this.ordersGateway.emitOrderStatusUpdated({ orderId, status: dto.status });
      }

      return this.withTypeDisplay(updated);
    }
    const dataUpdate: Prisma.OrderUpdateInput = {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.paymentStatus !== undefined && {
        paymentStatus: dto.paymentStatus,
      }),
    };

    if (dto.paymentStatus) {
      dataUpdate.paymentStatus = dto.paymentStatus;
      if (dto.paymentStatus === PaymentStatus.paid) {
        dataUpdate.paidAt = new Date();
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: dataUpdate,
      include: adminOrderInclude,
    });

    if (shouldRewardPoints) {
      this.fireOrderCompletionSideEffects(updated.id);
    }

    if (dto.status !== undefined) {
      this.ordersGateway.emitOrderStatusUpdated({ orderId, status: dto.status });
    }

    return this.withTypeDisplay(updated);
  }

  private fireOrderCompletionSideEffects(orderId: string) {
    void this.pointOrderReward
      .tryRewardOrderCompletion(orderId)
      .catch((err: unknown) => {
        this.logger.error(err);
      });
    void this.referralRewardProcessing
      .tryProcessReferralOnOrderCompleted(orderId)
      .catch((err: unknown) => {
        this.logger.error(err);
      });
  }

  async bulkUpdateStatus(dto: BulkUpdateOrderStatusDto) {
    const updated = await this.prisma.order.updateMany({
      where: { id: { in: dto.orderIds } },
      data: { status: dto.status },
    });

    if (dto.status === OrderStatus.completed) {
      for (const id of dto.orderIds) {
        this.fireOrderCompletionSideEffects(id);
      }
    }

    for (const id of dto.orderIds) {
      this.ordersGateway.emitOrderStatusUpdated({ orderId: id, status: dto.status });
    }

    return { updated: updated.count };
  }

  async assignShipper(orderId: string, dto: AssignShipperDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException({
        message: 'Không tìm thấy đơn.',
        code: 'ORDER_NOT_FOUND',
      });
    }
    if (order.type !== OrderType.delivery) {
      throw new BadRequestException({
        message: 'Chỉ đơn giao hàng (delivery) mới gán shipper.',
        code: 'ORDER_ASSIGN_SHIPPER_NOT_DELIVERY',
      });
    }

    const shipper = await this.prisma.shipper.findFirst({
      where: { id: dto.shipperId, isActive: true },
    });
    if (!shipper) {
      throw new BadRequestException({
        message: 'Shipper không tồn tại hoặc đang tắt.',
        code: 'SHIPPER_INVALID',
      });
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { shipperId: dto.shipperId },
      include: adminOrderInclude,
    });
    this.ordersGateway.emitShipperAssigned({ orderId, shipperId: dto.shipperId });
    return this.withTypeDisplay(updated);
  }

  private withTypeDisplay(order: AdminOrderPayload) {
    const typeDisplay =
      order.type === OrderType.delivery
        ? {
          kind: 'delivery' as const,
          delivery: {
            shipperId: order.shipperId,
            shipper: order.shipper,
            address: order.address,
            guestDeliveryAddress: order.guestDeliveryAddress,
            guestDeliveryPhone: order.guestDeliveryPhone,
            guestDeliveryName: order.guestDeliveryName,
          },
        }
        : order.type === OrderType.table
          ? {
            kind: 'table' as const,
            table: { tableId: order.tableId, table: order.table },
          }
          : {
            kind: 'pickup' as const,
            pickup: { pickupTime: order.pickupTime },
          };

    return { ...order, typeDisplay };
  }
}
