import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { GroupOrderModule } from '../group-order/group-order.module';
import { PointModule } from '../point/point.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SepayWebhookController } from './sepay-webhook.controller';
import { SepayWebhookService } from './sepay-webhook.service';

@Module({
  imports: [PrismaModule, PointModule, EventsModule, GroupOrderModule],
  controllers: [SepayWebhookController],
  providers: [SepayWebhookService],
})
export class WebhookModule {}
