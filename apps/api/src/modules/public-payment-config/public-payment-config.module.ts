import { Module } from '@nestjs/common';
import { AdminPaymentConfigModule } from '../admin/payment-config/admin-payment-config.module';
import { PublicPaymentConfigController } from './public-payment-config.controller';

@Module({
  imports: [AdminPaymentConfigModule],
  controllers: [PublicPaymentConfigController],
})
export class PublicPaymentConfigModule {}
