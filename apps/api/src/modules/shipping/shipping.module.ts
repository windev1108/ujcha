import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { WeatherService } from './weather.service';

@Module({
  controllers: [ShippingController],
  providers: [ShippingService, WeatherService],
  exports: [ShippingService],
})
export class ShippingModule {}
