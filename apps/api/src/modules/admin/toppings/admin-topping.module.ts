// src/modules/admin/toppings/admin-topping.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { AdminToppingService } from './admin-topping.service';
import { AdminToppingController } from './admin-topping.controller';
import { PricingService } from '../../pricing/pricing.service';
import { PricingConfigService } from '../../pricing/pricing-config.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AdminToppingController],
  providers: [AdminToppingService, PricingService, PricingConfigService],
})
export class AdminToppingModule { }
