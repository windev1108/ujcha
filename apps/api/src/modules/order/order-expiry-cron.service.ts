import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { GroupOrderStatus, GroupParticipantPaymentType, OrderStatus, PaymentStatus, PaymentType } from '@prisma/client';
import { OrdersGateway } from '../events/orders.gateway';
import { GroupOrderGateway } from '../group-order/group-order.gateway';
import { GroupOrderService } from '../group-order/group-order.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderExpiryCronService {
  private readonly logger = new Logger(OrderExpiryCronService.name);
  private readonly expiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ordersGateway: OrdersGateway,
    private readonly groupOrderGateway: GroupOrderGateway,
    private readonly groupOrderService: GroupOrderService,
  ) {
    const raw = this.config.get<string>('ORDER_BANK_TRANSFER_EXPIRY_MINUTES');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    this.expiryMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
    this.logger.log(`Bank-transfer expiry window: ${this.expiryMinutes} min`);
  }

  @Cron('*/2 * * * *')
  async handleExpireOrders() {
    try {
      await Promise.all([
        this.cancelExpiredRegularOrders(),
        this.cancelExpiredGroupOrders(),
      ]);
    } catch (err: any) {
      if (err?.code === 'P2024') {
        this.logger.warn('Connection pool busy during expiry cron — will retry next cycle');
        return;
      }
      this.logger.error('Expiry cron failed', err);
    }
  }

  /** Regular (non-group) bank_transfer orders: expire after ORDER_BANK_TRANSFER_EXPIRY_MINUTES */
  private async cancelExpiredRegularOrders() {
    const cutoff = new Date(Date.now() - this.expiryMinutes * 60_000);

    const expiring = await this.prisma.order.findMany({
      where: {
        paymentType: PaymentType.bank_transfer,
        paymentStatus: PaymentStatus.pending,
        status: OrderStatus.pending,
        createdAt: { lt: cutoff },
        groupOrder: null,
      },
      select: { id: true },
    });

    if (expiring.length === 0) return;

    const ids = expiring.map((o) => o.id);

    await this.prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { status: OrderStatus.cancelled },
    });

    // Notify all clients watching these orders
    for (const id of ids) {
      this.ordersGateway.emitOrderStatusUpdated({ orderId: id, status: 'cancelled' });
    }

    this.logger.log(
      `Auto-cancelled ${expiring.length} expired regular bank_transfer order(s) (>${this.expiryMinutes} min)`,
    );
  }

  /**
   * Group bank_transfer orders: expire after the same ORDER_BANK_TRANSFER_EXPIRY_MINUTES window
   * measured from order.createdAt. Emits realtime updates to all group members.
   */
  private async cancelExpiredGroupOrders() {
    const cutoff = new Date(Date.now() - this.expiryMinutes * 60_000);

    const expiredGroups = await this.prisma.groupOrder.findMany({
      where: {
        status: GroupOrderStatus.locked,
        paymentType: GroupParticipantPaymentType.bank_transfer,
        orderId: { not: null },
        order: {
          paymentStatus: PaymentStatus.pending,
          status: OrderStatus.pending,
          createdAt: { lt: cutoff },
        },
        // For split mode: do not cancel if at least one participant has already paid
        NOT: {
          participants: {
            some: { paymentStatus: PaymentStatus.paid },
          },
        },
      },
      select: { id: true, orderId: true, token: true },
    });

    if (expiredGroups.length === 0) return;

    const groupIds = expiredGroups.map((g) => g.id);
    const orderIds = expiredGroups.map((g) => g.orderId!);

    await this.prisma.$transaction([
      this.prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: OrderStatus.cancelled },
      }),
      this.prisma.groupOrder.updateMany({
        where: { id: { in: groupIds } },
        data: { status: GroupOrderStatus.cancelled },
      }),
    ]);

    // Emit realtime updates for each expired group so all members' UIs update
    await Promise.allSettled(
      expiredGroups.map(async (g) => {
        // Update order detail page for all participants viewing this order
        this.ordersGateway.emitOrderStatusUpdated({ orderId: g.orderId!, status: 'cancelled' });

        // Update group order page with full cancelled state
        try {
          const state = await this.groupOrderService.findByToken(g.token);
          this.groupOrderGateway.broadcast(g.token, state);
        } catch (err) {
          this.logger.warn(`Failed to broadcast group cancellation for ${g.token}: ${err}`);
        }
      }),
    );

    this.logger.log(
      `Auto-cancelled ${expiredGroups.length} expired group bank_transfer order(s) — realtime emitted`,
    );
  }
}
