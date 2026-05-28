import { Module } from '@nestjs/common';
import { OrderModule } from '../../order/order.module';
import { PointModule } from '../../point/point.module';
import { ReferralModule } from '../../referral/referral.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsModule } from '../../events/events.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminOrderController } from './admin-order.controller';
import { AdminOrderService } from './admin-order.service';

@Module({
  imports: [
    PrismaModule,
    AdminAuthModule,
    OrderModule,
    PointModule,
    ReferralModule,
    EventsModule,
  ],
  controllers: [AdminOrderController],
  providers: [AdminOrderService],
  exports: [AdminOrderService],
})
export class AdminOrderModule {}
