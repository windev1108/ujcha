import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STATUS_PUSH_MESSAGES } from './order-status-messages';
import { OrderStatus } from '@prisma/client';

export interface PushPayload {
    title: string;
    body: string;
    url: string;
}

@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);
    private enabled = false;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
        const subject =
            this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:support@ujcha.vn';
        if (publicKey && privateKey) {
            webpush.setVapidDetails(subject, publicKey, privateKey);
            this.enabled = true;
        } else {
            this.logger.warn('VAPID keys chưa cấu hình — Web Push đang bị tắt.');
        }
    }

    async subscribe(input: {
        endpoint: string;
        p256dh: string;
        auth: string;
        deviceId: string;
        participantId?: string;
        userId?: string;
    }) {
        return this.prisma.pushSubscription.upsert({
            where: { endpoint: input.endpoint },
            create: {
                endpoint: input.endpoint,
                p256dh: input.p256dh,
                auth: input.auth,
                deviceId: input.deviceId,
                participantId: input.participantId ?? null,
                userId: input.userId ?? null,
            },
            update: {
                p256dh: input.p256dh,
                auth: input.auth,
                deviceId: input.deviceId,
                participantId: input.participantId ?? null,
                userId: input.userId ?? null,
            },
        });
    }

    async unsubscribe(endpoint: string) {
        await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    }

    async sendToParticipant(participantId: string, payload: PushPayload) {
        if (!this.enabled) return;
        const subs = await this.prisma.pushSubscription.findMany({
            where: { participantId },
        });
        await Promise.allSettled(
            subs.map((s) =>
                webpush
                    .sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify(payload),
                    )
                    .catch(async (err: any) => {
                        // 404/410 = subscription hết hạn hoặc user đã revoke → dọn luôn
                        if (err?.statusCode === 410 || err?.statusCode === 404) {
                            await this.prisma.pushSubscription
                                .delete({ where: { id: s.id } })
                                .catch(() => { });
                        } else {
                            this.logger.warn(`Push failed (sub ${s.id}): ${err?.message}`);
                        }
                    }),
            ),
        );
    }

    async sendToParticipants(participantIds: string[], payload: PushPayload) {
        if (!this.enabled || participantIds.length === 0) return;
        const subs = await this.prisma.pushSubscription.findMany({
            where: { participantId: { in: participantIds } },
        });
        await Promise.allSettled(
            subs.map((s) =>
                webpush
                    .sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify(payload),
                    )
                    .catch(async (err: any) => {
                        if (err?.statusCode === 410 || err?.statusCode === 404) {
                            await this.prisma.pushSubscription
                                .delete({ where: { id: s.id } })
                                .catch(() => { });
                        } else {
                            this.logger.warn(`Push failed (sub ${s.id}): ${err?.message}`);
                        }
                    }),
            ),
        );
    }

    /** Gửi push status-update tới TẤT CẢ participant của group order gắn với orderId này — không cần đăng nhập, không phân biệt payment type. */
    async notifyOrderStatusToParticipants(
        orderId: string,
        status: OrderStatus,
        paymentCode: string,
    ) {
        this.logger.log(`notifyOrderStatusToParticipants called: orderId=${orderId} status=${status} enabled=${this.enabled}`);
        if (!this.enabled) return;
        const msg = ORDER_STATUS_PUSH_MESSAGES[status];
        if (!msg) return;

        const groupOrder = await this.prisma.groupOrder.findUnique({
            where: { orderId },
            select: { participants: { select: { id: true } } },
        });
        if (!groupOrder || groupOrder.participants.length === 0) return;

        await this.sendToParticipants(
            groupOrder.participants.map((p) => p.id),
            { title: msg.title, body: msg.body(paymentCode), url: `/order/${paymentCode}` },
        );
    }
}