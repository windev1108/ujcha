import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
    PAYMENT_REMINDER_QUEUE,
    REMINDER_DELAYS_MS,
    type ReminderJobData,
} from './payment-reminder.constants';

@Injectable()
export class PaymentReminderService {
    constructor(
        @InjectQueue(PAYMENT_REMINDER_QUEUE)
        private readonly queue: Queue<ReminderJobData>,
    ) { }

    private jobId(participantId: string, step: number) {
        return `reminder:${participantId}:${step}`;
    }

    /** Lên lịch cả chuỗi nhắc cho 1 participant chưa thanh toán. */
    async scheduleForParticipant(participantId: string, paymentCode: string) {
        await Promise.all(
            REMINDER_DELAYS_MS.map((delay, step) =>
                this.queue.add(
                    'remind',
                    { participantId, paymentCode, step },
                    { jobId: this.jobId(participantId, step), delay },
                ),
            ),
        );
    }

    /** Huỷ toàn bộ job còn lại của 1 participant — gọi khi đã trả tiền / rời nhóm / huỷ đơn. */
    async cancelForParticipant(participantId: string) {
        await Promise.all(
            REMINDER_DELAYS_MS.map(async (_, step) => {
                const job = await this.queue.getJob(this.jobId(participantId, step));
                if (job) await job.remove().catch(() => { });
            }),
        );
    }
}