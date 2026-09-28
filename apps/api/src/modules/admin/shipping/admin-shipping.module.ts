import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { ShippingModule } from '../../shipping/shipping.module';
import { AdminShippingController } from './admin-shipping.controller';
import { WeatherService } from '../../shipping/weather.service';

@Module({
  imports: [AdminAuthModule, ShippingModule],
  providers: [WeatherService],
  controllers: [AdminShippingController],
})
export class AdminShippingModule {}
