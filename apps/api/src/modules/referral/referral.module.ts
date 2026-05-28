import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PointModule } from '../point/point.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralController } from './referral.controller';
import { ReferralRewardProcessingService } from './referral-reward-processing.service';
import { ReferralService } from './referral.service';

@Module({
  imports: [PrismaModule, PointModule, AuthModule],
  controllers: [ReferralController],
  providers: [ReferralRewardProcessingService, ReferralService],
  exports: [ReferralRewardProcessingService, ReferralService],
})
export class ReferralModule {}
