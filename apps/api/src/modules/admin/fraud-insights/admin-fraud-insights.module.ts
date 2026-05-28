import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminFraudInsightsController } from './admin-fraud-insights.controller';
import { AdminFraudInsightsService } from './admin-fraud-insights.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminFraudInsightsController],
  providers: [AdminFraudInsightsService],
})
export class AdminFraudInsightsModule {}
