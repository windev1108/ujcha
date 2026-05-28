import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PointCampaignController } from './point-campaign.controller';
import { PointExpiryCronService } from './point-expiry-cron.service';
import { PointOrderRewardService } from './point-order-reward.service';
import { PointPolicyService } from './point-policy.service';
import { PointRewardController } from './point-reward.controller';
import { PointRewardService } from './point-reward.service';
import { PointService } from './point.service';
import { PromotionsController } from './promotions.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PointCampaignController, PromotionsController, PointRewardController],
  providers: [
    PointService,
    PointExpiryCronService,
    PointPolicyService,
    PointOrderRewardService,
    PointRewardService,
  ],
  exports: [PointService, PointOrderRewardService, PointPolicyService, PointRewardService],
})
export class PointModule {}
