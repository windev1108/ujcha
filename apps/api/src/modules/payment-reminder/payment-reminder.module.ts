import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { PAYMENT_REMINDER_QUEUE } from './payment-reminder.constants';
import { PaymentReminderProcessor } from './payment-reminder.processor';
import { PaymentReminderService } from './payment-reminder.service';

@Module({
    imports: [
        BullModule.registerQueueAsync({
            name: PAYMENT_REMINDER_QUEUE,
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                connection: { url: config.get<string>('REDIS_URL') },
                defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
            }),
            inject: [ConfigService],
        }),
        PrismaModule,
        PushModule,
    ],
    providers: [PaymentReminderService, PaymentReminderProcessor],
    exports: [PaymentReminderService],
})
export class PaymentReminderModule { }