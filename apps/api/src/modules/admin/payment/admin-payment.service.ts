import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminPaymentListQueryDto } from './dto/admin-payment-list-query.dto';
import type { AdminWebhookLogListQueryDto } from './dto/admin-webhook-log-list-query.dto';

const orderBrief = {
  select: {
    id: true,
    paymentCode: true,
    finalAmount: true,
    paymentStatus: true,
    type: true,
  },
} as const;

@Injectable()
export class AdminPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayments(query: AdminPaymentListQueryDto) {
    const take = query.limit ?? 50;
    const skip = query.skip ?? 0;

    return this.prisma.payment.findMany({
      where: query.orderId ? { orderId: query.orderId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { order: orderBrief },
    });
  }

  async getPaymentById(id: string) {
    const row = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: orderBrief },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy giao dịch.',
        code: 'PAYMENT_NOT_FOUND',
      });
    }
    return row;
  }

  async listWebhookLogs(query: AdminWebhookLogListQueryDto) {
    const take = query.limit ?? 50;
    const skip = query.skip ?? 0;

    return this.prisma.paymentWebhookLog.findMany({
      where: query.orderId ? { orderId: query.orderId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: { order: orderBrief },
    });
  }

  async getWebhookLogById(id: string) {
    const row = await this.prisma.paymentWebhookLog.findUnique({
      where: { id },
      include: { order: orderBrief },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Không tìm thấy webhook log.',
        code: 'PAYMENT_WEBHOOK_LOG_NOT_FOUND',
      });
    }
    return row;
  }
}
