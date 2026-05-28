import { Module } from '@nestjs/common';
import { PointModule } from '../point/point.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [PrismaModule, PointModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
})
export class LoyaltyModule {}
