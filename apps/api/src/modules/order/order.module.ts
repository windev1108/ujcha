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
import { OrderValidationService } from './order-validation.service';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule, PointModule, ReferralModule],
  controllers: [OrderController],
  providers: [OrderService, OrderValidationService, OrderPointApplyService, OrderExpiryCronService],
  exports: [OrderService, OrderPointApplyService],
})
export class OrderModule {}
