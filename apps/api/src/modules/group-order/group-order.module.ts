import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { GroupOrderController } from './group-order.controller';
import { GroupOrderGateway } from './group-order.gateway';
import { GroupOrderService } from './group-order.service';
import { MailService } from '../mail/mail.service';
import { StoreModule } from '../store/store.module';
import { OrderService } from '../order/order.service';
import { OrderValidationService } from '../order/order-validation.service';
import { PointService } from '../point/point.service';
import { PointOrderRewardService } from '../point/point-order-reward.service';
import { PointPolicyService } from '../point/point-policy.service';
import { ReferralRewardProcessingService } from '../referral/referral-reward-processing.service';
import { InventoryService } from '../admin/inventory/inventory.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    NotificationModule,
    StoreModule,
  ],
  controllers: [GroupOrderController],
  providers: [
    GroupOrderService,
    GroupOrderGateway,
    MailService,
    OrderService,
    OrderValidationService,
    PointService,
    PointOrderRewardService,
    PointPolicyService,
    ReferralRewardProcessingService,
    InventoryService,
  ],
  exports: [GroupOrderService, GroupOrderGateway, MailService],
})
export class GroupOrderModule {}
