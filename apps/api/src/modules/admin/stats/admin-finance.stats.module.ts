import { Module } from '@nestjs/common';
import { AdminFinanceStatsController } from './admin-finance-stats.controller';
import { AdminFinanceStatsService } from './admin-finance-stats.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../../pricing/pricing.module';
import { AdminCustomerStatsService } from './admin-customer-stats.service';
@Module({
  imports: [PrismaModule, PricingModule],
  controllers: [AdminFinanceStatsController],
  providers: [AdminFinanceStatsService, AdminCustomerStatsService],
})
export class AdminFinanceStatsModule { }
