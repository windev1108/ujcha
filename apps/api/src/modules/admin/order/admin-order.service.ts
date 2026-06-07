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
  PointTransactionType,
  Prisma,
} from '@prisma/client';
import { PointOrderRewardService } from '../../point/point-order-reward.service';
import { PointService } from '../../point/point.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralRewardProcessingService } from '../../referral/referral-reward-processing.service';
import { OrderService } from '../../order/order.service';
import { OrdersGateway } from '../../events/orders.gateway';
import { NotificationService } from '../../notification/notification.service';
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
  groupOrder: {
    select: {
      id: true,
      token: true,
      paymentMode: true,
      participants: {
        orderBy: { joinedAt: 'asc' as const },
        select: {
          id: true,
          userId: true,
          guestName: true,
          isHost: true,
          user: { select: { id: true, name: true } },
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              selectedOptions: true,
              toppingsJson: true,
              note: true,
              product: { select: { id: true, name: true, imageUrls: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export type AdminOrderPayload = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

const STATUS_NOTIF: Partial<Record<OrderStatus, (code: string) => { title: string; content: string; notifKey: string }>> = {
  [OrderStatus.confirmed]: (code) => ({
    title: 'Đơn hàng đã được xác nhận',
    content: `Đơn #${code} đã xác nhận và đang được chuẩn bị.`,
    notifKey: 'order_confirmed',
  }),
  [OrderStatus.preparing]: (code) => ({
    title: 'Đơn đang được pha chế',
    content: `Đơn #${code} đang được pha chế, vui lòng chờ một chút!`,
    notifKey: 'order_preparing',
  }),
  [OrderStatus.ready]: (code) => ({
    title: 'Đơn hàng đã sẵn sàng',
    content: `Đơn #${code} đã sẵn sàng. Đến lấy hoặc chờ giao nhé!`,
    notifKey: 'order_ready',
  }),
  [OrderStatus.delivering]: (code) => ({
    title: 'Đơn đang trên đường giao',
    content: `Đơn #${code} đang trên đường đến bạn.`,
    notifKey: 'order_delivering',
  }),
  [OrderStatus.arrived]: (code) => ({
    title: 'Shipper đã đến nơi',
    content: `Đơn #${code} đã đến địa chỉ giao hàng.`,
    notifKey: 'order_arrived',
  }),
  [OrderStatus.cancelled]: (code) => ({
    title: 'Đơn hàng đã bị hủy',
    content: `Đơn #${code} đã bị hủy.`,
    notifKey: 'order_cancelled',
  }),
};

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
    private readonly notificationService: NotificationService,
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
        const spendTs: Prisma.OrderUpdateInput = {};
        if (dto.status === OrderStatus.confirmed)  spendTs.confirmedAt  = new Date();
        if (dto.status === OrderStatus.preparing)  spendTs.preparingAt  = new Date();
        if (dto.status === OrderStatus.ready)      spendTs.readyAt      = new Date();
        if (dto.status === OrderStatus.completed)  spendTs.completedAt  = new Date();
        if (dto.status === OrderStatus.cancelled)  spendTs.cancelledAt  = new Date();

        return tx.order.update({
          where: { id: orderId },
          data: {
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.paymentStatus !== undefined && {
              paymentStatus: dto.paymentStatus,
            }),
            pointsConsumed: existing.pointsReserved,
            pointsReserved: 0,
            ...spendTs,
          },
          include: adminOrderInclude,
        });
      });

      if (shouldRewardPoints) {
        this.fireOrderCompletionSideEffects(updated.id, existing.userId, updated.paymentCode);
      } else if (dto.status !== undefined) {
        const nFn = STATUS_NOTIF[dto.status];
        if (nFn) {
          const { title, content, notifKey } = nFn(updated.paymentCode);
          void this.resolveOrderUserIds(updated.id, existing.userId).then((userIds) =>
            this.notificationService.upsertOrderNotificationForMany(userIds, {
              type: 'order', title, content,
              data: { orderId: updated.id, paymentCode: updated.paymentCode, notifKey },
            }),
          ).catch(() => null);
        }
      }

      if (dto.status !== undefined) {
        this.ordersGateway.emitOrderStatusUpdated({ orderId, status: dto.status });
      }

      return this.withTypeDisplay(updated);
    }
    const statusTs: Prisma.OrderUpdateInput = {};
    if (dto.status === OrderStatus.confirmed)  statusTs.confirmedAt  = new Date();
    if (dto.status === OrderStatus.preparing)  statusTs.preparingAt  = new Date();
    if (dto.status === OrderStatus.ready)      statusTs.readyAt      = new Date();
    if (dto.status === OrderStatus.delivering) statusTs.deliveringAt = new Date();
    if (dto.status === OrderStatus.completed)  statusTs.completedAt  = new Date();
    if (dto.status === OrderStatus.cancelled)  statusTs.cancelledAt  = new Date();

    const dataUpdate: Prisma.OrderUpdateInput = {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.paymentStatus !== undefined && {
        paymentStatus: dto.paymentStatus,
      }),
      ...statusTs,
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
      this.fireOrderCompletionSideEffects(updated.id, existing.userId, updated.paymentCode);
    } else if (dto.status !== undefined) {
      const nFn = STATUS_NOTIF[dto.status];
      if (nFn) {
        const { title, content, notifKey } = nFn(updated.paymentCode);
        void this.resolveOrderUserIds(updated.id, existing.userId).then((userIds) =>
          this.notificationService.upsertOrderNotificationForMany(userIds, {
            type: 'order', title, content,
            data: { orderId: updated.id, paymentCode: updated.paymentCode, notifKey },
          }),
        ).catch(() => null);
      }
    }

    if (dto.status !== undefined) {
      this.ordersGateway.emitOrderStatusUpdated({ orderId, status: dto.status });

      if (
        dto.status === OrderStatus.confirmed &&
        existing.type === OrderType.delivery &&
        !existing.shipperId
      ) {
        this.ordersGateway.emitNewDeliveryOrder({
          orderId: updated.id,
          paymentCode: updated.paymentCode,
          customerName: updated.user?.name ?? (updated as any).guestDeliveryName ?? 'Khách',
          customerPhone: updated.user?.phone ?? (updated as any).guestDeliveryPhone ?? '',
          address: updated.address?.fullAddress ?? '',
          addressNote: updated.address?.note ?? null,
          lat: updated.address ? (updated.address as any).lat ?? null : null,
          lng: updated.address ? (updated.address as any).lng ?? null : null,
          items: updated.items.map((i) => ({
            name: i.product?.name ?? '',
            quantity: i.quantity,
            price: Number(i.price),
            imageUrl: i.product?.imageUrls?.[0] ?? null,
            optionsJson: (i.optionsJson ?? {}) as Record<string, string>,
            extrasJson: (i.extrasJson ?? []) as Array<{ name: string; price: number }>,
            note: i.note ?? null,
          })),
          totalAmount: Number(updated.finalAmount),
          shippingFee: Number(updated.shippingFee),
          paymentType: updated.paymentType,
        });
      }

      if (updated.shipperId) {
        this.ordersGateway.emitShipperOrderStatusUpdated({
          orderId,
          status: dto.status,
          shipperId: updated.shipperId,
        });
      } else if (updated.type === OrderType.delivery && dto.status !== undefined) {
        // No shipper yet — broadcast to all shippers so their available-orders list stays current
        this.ordersGateway.emitAvailableOrderStatus({ orderId, status: dto.status });
      }
    }

    return this.withTypeDisplay(updated);
  }

  private async resolveOrderUserIds(orderId: string, ownerUserId: string | null): Promise<string[]> {
    const participants = await this.prisma.groupOrderParticipant.findMany({
      where: { groupOrder: { orderId }, userId: { not: null } },
      select: { userId: true },
    });
    const ids = new Set<string>();
    if (ownerUserId) ids.add(ownerUserId);
    for (const p of participants) if (p.userId) ids.add(p.userId);
    return [...ids];
  }

  private fireOrderCompletionSideEffects(orderId: string, userId?: string | null, paymentCode?: string) {
    void this.referralRewardProcessing
      .tryProcessReferralOnOrderCompleted(orderId)
      .catch((err: unknown) => { this.logger.error(err); });
    void this.rewardAndNotifyCompletion(orderId, userId ?? null, paymentCode ?? '')
      .catch((err: unknown) => { this.logger.error(err); });
  }

  private async rewardAndNotifyCompletion(orderId: string, ownerId: string | null, paymentCode: string) {
    try {
      await this.pointOrderReward.tryRewardOrderCompletion(orderId);
    } catch (err) {
      this.logger.error(err);
    }

    const allUserIds = await this.resolveOrderUserIds(orderId, ownerId);
    if (allUserIds.length === 0) return;

    const points = ownerId
      ? await this.prisma.pointTransaction.findFirst({
          where: { userId: ownerId, source: PointSource.order, referenceId: orderId, type: PointTransactionType.earn },
          select: { amount: true },
        }).then((t) => (t ? Math.round(Number(t.amount) * 10) / 10 : 0)).catch(() => 0)
      : 0;

    await Promise.allSettled(
      allUserIds.map((userId) =>
        this.notificationService.upsertOrderNotification({
          userId,
          type: 'order',
          title: 'Đơn hàng hoàn thành',
          content: userId === ownerId && points > 0
            ? `Đơn #${paymentCode} hoàn thành. Bạn tích được ${points} điểm!`
            : `Đơn #${paymentCode} hoàn thành. Cảm ơn bạn đã sử dụng UjCha!`,
          data: { orderId, paymentCode, earnedPoints: userId === ownerId ? points : 0, notifKey: 'order_completed' },
        }),
      ),
    );
  }

  async bulkUpdateStatus(dto: BulkUpdateOrderStatusDto) {
    const bulkTs: Record<string, Date> = {};
    if (dto.status === OrderStatus.confirmed)  bulkTs.confirmedAt  = new Date();
    if (dto.status === OrderStatus.preparing)  bulkTs.preparingAt  = new Date();
    if (dto.status === OrderStatus.ready)      bulkTs.readyAt      = new Date();
    if (dto.status === OrderStatus.delivering) bulkTs.deliveringAt = new Date();
    if (dto.status === OrderStatus.completed)  bulkTs.completedAt  = new Date();
    if (dto.status === OrderStatus.cancelled)  bulkTs.cancelledAt  = new Date();

    const updated = await this.prisma.order.updateMany({
      where: { id: { in: dto.orderIds } },
      data: { status: dto.status, ...bulkTs },
    });

    for (const id of dto.orderIds) {
      this.ordersGateway.emitOrderStatusUpdated({ orderId: id, status: dto.status });
    }

    const bulkOrders = await this.prisma.order.findMany({
      where: { id: { in: dto.orderIds } },
      select: { id: true, userId: true, paymentCode: true },
    });

    for (const o of bulkOrders) {
      if (dto.status === OrderStatus.completed) {
        this.fireOrderCompletionSideEffects(o.id, o.userId, o.paymentCode);
      } else {
        const nFn = STATUS_NOTIF[dto.status];
        if (nFn) {
          const { title, content, notifKey } = nFn(o.paymentCode);
          void this.resolveOrderUserIds(o.id, o.userId).then((userIds) =>
            this.notificationService.upsertOrderNotificationForMany(userIds, {
              type: 'order', title, content,
              data: { orderId: o.id, paymentCode: o.paymentCode, notifKey },
            }),
          ).catch(() => null);
        }
      }
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
