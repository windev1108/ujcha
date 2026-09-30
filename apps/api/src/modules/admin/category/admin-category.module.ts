import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminCategoryController } from './admin-category.controller';
import { AdminCategoryService } from './admin-category.service';
import { PricingService } from '../../pricing/pricing.service';
import { PricingConfigService } from '../../pricing/pricing-config.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminCategoryController],
  providers: [AdminCategoryService, PricingService, PricingConfigService],
})
export class AdminCategoryModule { }
