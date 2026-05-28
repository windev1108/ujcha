import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { ShippingModule } from '../../shipping/shipping.module';
import { AdminShippingController } from './admin-shipping.controller';

@Module({
  imports: [AdminAuthModule, ShippingModule],
  controllers: [AdminShippingController],
})
export class AdminShippingModule {}
