import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PointCampaignController } from './point-campaign.controller';
import { PointExpiryCronService } from './point-expiry-cron.service';
import { PointOrderRewardService } from './point-order-reward.service';
import { PointPolicyService } from './point-policy.service';
import { PointService } from './point.service';
import { PromotionsController } from './promotions.controller';
import { PointPublicController } from './point-public.controller';
import { OrderPointApplyService } from '../order/order-point-apply.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    PointCampaignController,
    PromotionsController,
    PointPublicController,
  ],
  providers: [
    PointService,
    PointExpiryCronService,
    PointPolicyService,
    PointOrderRewardService,
    OrderPointApplyService,
  ],
  exports: [
    PointService,
    PointOrderRewardService,
    PointPolicyService,
    OrderPointApplyService,
  ],
})
export class PointModule {}
