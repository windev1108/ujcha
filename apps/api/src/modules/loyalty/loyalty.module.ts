import { Module } from '@nestjs/common';
import { PointModule } from '../point/point.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [PrismaModule, PointModule, NotificationModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
})
export class LoyaltyModule {}
