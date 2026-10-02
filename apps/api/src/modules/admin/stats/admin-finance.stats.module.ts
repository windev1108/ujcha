import { Module } from '@nestjs/common';
import { AdminFinanceStatsController } from './admin-finance-stats.controller';
import { AdminFinanceStatsService } from './admin-finance-stats.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../../pricing/pricing.module';
@Module({
  imports: [PrismaModule, PricingModule],
  controllers: [AdminFinanceStatsController],
  providers: [AdminFinanceStatsService],
})
export class AdminFinanceStatsModule {}
