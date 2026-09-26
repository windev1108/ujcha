import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { PointModule } from '../point/point.module';
import { ReferralModule } from '../referral/referral.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderController } from './order.controller';
import { OrderExpiryCronService } from './order-expiry-cron.service';
import { OrderPointApplyService } from './order-point-apply.service';
import { OrderService } from './order.service';
import { NotificationModule } from '../notification/notification.module';
import { OrderValidationService } from './order-validation.service';
import { GroupOrderModule } from '../group-order/group-order.module';
import { MailService } from '../mail/mail.service';
import { InventoryModule } from '../admin/inventory/inventory.module';
import { StoreModule } from '../store/store.module';
import { ChatModule } from '../chat/chat.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    PointModule,
    ReferralModule,
    NotificationModule,
    GroupOrderModule,
    InventoryModule,
    StoreModule,
    ChatModule,
    UploadModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderValidationService,
    OrderPointApplyService,
    OrderExpiryCronService,
    MailService,
  ],
  exports: [OrderService, OrderPointApplyService, MailService],
})
export class OrderModule {}
