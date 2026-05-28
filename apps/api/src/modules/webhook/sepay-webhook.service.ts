import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus, PointSource, Prisma } from '@prisma/client';
import { OrdersGateway } from '../events/orders.gateway';
import { GroupOrderGateway } from '../group-order/group-order.gateway';
import { GroupOrderService } from '../group-order/group-order.service';
import { PointService } from '../point/point.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SepayWebhookPayloadDto } from './dto/sepay-webhook-payload.dto';

@Injectable()
export class SepayWebhookService {
  private readonly logger = new Logger(SepayWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
    private readonly ordersGateway: OrdersGateway,
    private readonly groupOrderService: GroupOrderService,
    private readonly groupOrderGateway: GroupOrderGateway,
  ) { }

  async handle(
    payload: SepayWebhookPayloadDto,
    rawBody: string,
    authHeader: string | undefined,
  ): Promise<{ success: boolean; message: string }> {
    // Always persist the raw log first
    const log = await this.prisma.paymentWebhookLog.create({
      data: {
        provider: 'sepay',
        path: '/webhooks/sepay',
        rawBody,
        headersJson: authHeader ? { authorization: authHeader } : Prisma.JsonNull,
        status: 'received',
      },
    });

    try {
      // 1. Verify config is active
      const config = await this.prisma.paymentConfig.findUnique({
        where: { id: 'default' },
      });

      if (!config?.isEnabled) {
        await this.setLogStatus(log.id, 'skipped', 'Payment config disabled');
        return { success: false, message: 'Payment config disabled' };
      }

      // 2. Verify API key when configured
      if (config.sePayApiKey) {
        // SePay sends: Authorization: Apikey <token>
        const token = authHeader?.replace(/^Apikey\s+/i, '').trim() ?? '';
        if (token !== config.sePayApiKey) {
          await this.setLogStatus(log.id, 'unauthorized', 'API key mismatch');
          return { success: false, message: 'Unauthorized' };
        }
      }

      // 3. Only handle incoming transfers
      if (payload.transferType !== 'in') {
        await this.setLogStatus(log.id, 'skipped', 'transferType is not "in"');
        return { success: true, message: 'Skipped outgoing transfer' };
      }

      // 4. Match pending order: find where order.paymentCode appears in SePay content.
      //    Normalize by removing hyphens — some banks/MoMo strip them in transfer memos.
      const normalize = (s: string) => s.toLowerCase().replace(/-/g, '');
      const content = normalize(payload.content ?? '');
      const pendingOrders = await this.prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.pending },
        select: {
          id: true,
          paymentCode: true,
          finalAmount: true,
          pointsReserved: true,
          userId: true,
        },
      });

      const matched = pendingOrders.find((o) =>
        content.includes(normalize(o.paymentCode)),
      );

      if (!matched) {
        // Try matching a group order participant by paymentQrToken (split bank_transfer)
        const pendingParticipants = await this.prisma.groupOrderParticipant.findMany({
          where: {
            paymentStatus: 'pending' as any,
            paymentType: 'bank_transfer' as any,
            paymentQrToken: { not: null },
          },
          select: { id: true, paymentQrToken: true },
        });

        const matchedParticipant = pendingParticipants.find((p) =>
          content.includes(normalize(p.paymentQrToken!.slice(0, 12))),
        );

        if (matchedParticipant) {
          const result = await this.groupOrderService.autoConfirmParticipantPaid(matchedParticipant.id);
          if (result) {
            this.groupOrderGateway.broadcast(result.token, result.state);
            await this.setLogStatus(log.id, 'group_participant_paid');
            this.logger.log(`Group participant ${matchedParticipant.id} marked paid — SePay tx #${payload.id}`);
            return { success: true, message: 'Group participant marked as paid' };
          }
        }

        await this.setLogStatus(
          log.id,
          'no_match',
          `No pending order matched content: "${payload.content?.slice(0, 80)}"`,
        );
        return { success: false, message: 'No matching order found' };
      }

      // 5. Mark paid inside a transaction (idempotency guard included)
      const result = await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.order.findUnique({
          where: { id: matched.id },
          select: { paymentStatus: true, pointsReserved: true, userId: true },
        });

        if (!fresh || fresh.paymentStatus === PaymentStatus.paid) {
          return { skipped: true } as const;
        }

        if (fresh.pointsReserved > 0 && fresh.userId) {
          await this.pointService.spendPointsTx(
            tx,
            fresh.userId,
            fresh.pointsReserved,
            { source: PointSource.order, referenceId: matched.id },
          );
        }

        await tx.order.update({
          where: { id: matched.id },
          data: {
            paymentStatus: PaymentStatus.paid,
            paidAt: new Date(),
            ...(fresh.pointsReserved > 0 && {
              pointsConsumed: fresh.pointsReserved,
              pointsReserved: 0,
            }),
          },
        });

        await tx.payment.create({
          data: {
            transactionId: String(payload.id),
            amount: new Prisma.Decimal(payload.transferAmount),
            content: payload.content,
            orderId: matched.id,
          },
        });

        return { skipped: false } as const;
      });

      if (result.skipped) {
        await this.setLogStatus(log.id, 'already_paid', undefined, matched.id);
        return { success: true, message: 'Already paid' };
      }

      await this.setLogStatus(log.id, 'success', undefined, matched.id);
      this.logger.log(
        `Order ${matched.id} marked paid — SePay tx #${payload.id}`,
      );
      this.ordersGateway.emitOrderPaid({
        orderId: matched.id,
        paymentCode: matched.paymentCode,
        transferAmount: payload.transferAmount,
        transactionId: String(payload.id),
      });
      return { success: true, message: 'Order marked as paid' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`SePay webhook error: ${msg}`, (err as Error)?.stack);
      await this.setLogStatus(log.id, 'error', msg).catch(() => null);
      // Return 200 so SePay does not retry an unrecoverable error
      return { success: false, message: 'Internal error' };
    }
  }

  private setLogStatus(
    id: string,
    status: string,
    errorMessage?: string,
    orderId?: string,
  ) {
    return this.prisma.paymentWebhookLog.update({
      where: { id },
      data: {
        status,
        ...(orderId ? { orderId } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      },
    });
  }
}
