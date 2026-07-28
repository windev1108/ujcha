import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
    PAYMENT_REMINDER_QUEUE,
    type ReminderJobData,
} from './payment-reminder.constants';

@Processor(PAYMENT_REMINDER_QUEUE)
export class PaymentReminderProcessor extends WorkerHost {
    private readonly logger = new Logger(PaymentReminderProcessor.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly pushService: PushService,
    ) {
        super();
    }

    async process(job: Job<ReminderJobData>) {
        const { participantId, paymentCode, step } = job.data;

        const participant = await this.prisma.groupOrderParticipant.findUnique({
            where: { id: participantId },
        });
        // Đã thanh toán / đã rời nhóm (bị xoá) → bỏ qua, không gửi
        if (!participant || participant.paymentStatus === 'paid') return;

        await this.pushService.sendToParticipant(participantId, {
            title: 'Bạn chưa thanh toán',
            body:
                step === 0
                    ? 'Nhấn để thanh toán phần của mình cho đơn nhóm.'
                    : `Đơn #${paymentCode} vẫn đang chờ bạn thanh toán.`,
            url: `/orders/${paymentCode}`,
        });

        this.logger.log(`Reminder step=${step} → participant=${participantId}`);
    }
}