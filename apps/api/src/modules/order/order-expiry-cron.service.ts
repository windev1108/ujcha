import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { GroupOrderStatus, OrderStatus, PaymentStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderExpiryCronService {
  private readonly logger = new Logger(OrderExpiryCronService.name);
  private readonly expiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('ORDER_BANK_TRANSFER_EXPIRY_MINUTES');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    this.expiryMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
    this.logger.log(`Bank-transfer expiry window: ${this.expiryMinutes} min`);
  }

  /** Runs every 2 minutes — auto-cancels unpaid bank_transfer orders past the expiry window */
  @Cron('*/2 * * * *')
  async handleExpireOrders() {
    const cutoff = new Date(Date.now() - this.expiryMinutes * 60_000);

    const expiring = await this.prisma.order.findMany({
      where: {
        paymentType: PaymentType.bank_transfer,
        paymentStatus: PaymentStatus.pending,
        status: OrderStatus.pending,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (expiring.length === 0) return;

    const ids = expiring.map((o) => o.id);

    await this.prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { status: OrderStatus.cancelled },
    });

    // Revert any group orders whose final order just expired back to locked so host can retry
    await this.prisma.groupOrder.updateMany({
      where: {
        orderId: { in: ids },
        status: GroupOrderStatus.completed,
      },
      data: { status: GroupOrderStatus.locked, orderId: null },
    });

    this.logger.log(
      `Auto-cancelled ${ids.length} expired bank_transfer order(s) (>${this.expiryMinutes} min unpaid)`,
    );
  }
}
