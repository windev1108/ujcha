import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminPaymentConfigController } from './admin-payment-config.controller';
import { AdminPaymentConfigService } from './admin-payment-config.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminPaymentConfigController],
  providers: [AdminPaymentConfigService],
  exports: [AdminPaymentConfigService],
})
export class AdminPaymentConfigModule {}
