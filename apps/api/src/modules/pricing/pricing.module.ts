import { Module } from '@nestjs/common';
import { AdminPricingController } from './admin-pricing.controller';
import { PricingConfigService } from './pricing-config.service';
import { PricingCostService } from './pricing-cost.service';
import { PricingService } from './pricing.service';

@Module({
  controllers: [AdminPricingController],
  providers: [PricingConfigService, PricingCostService, PricingService],
  exports: [PricingConfigService, PricingCostService, PricingService],
})
export class PricingModule {}
