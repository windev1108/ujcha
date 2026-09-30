import { ProductService } from './../../product/product.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminProductController } from './admin-product.controller';
import { AdminProductService } from './admin-product.service';
import { PricingCostService } from '../../pricing/pricing-cost.service';
import { PricingConfigService } from '../../pricing/pricing-config.service';
import { PricingService } from '../../pricing/pricing.service';

@Module({
  imports: [PrismaModule, RedisModule, AdminAuthModule],
  controllers: [AdminProductController],
  providers: [
    AdminProductService,
    ProductService,
    PricingCostService,
    PricingConfigService,
    PricingService,
  ],
})
export class AdminProductModule {}
