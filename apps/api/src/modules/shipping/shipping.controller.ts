import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';

@ApiTags('shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('config')
  @ApiOperation({ summary: 'Cấu hình phí giao hàng (public — chỉ đọc)' })
  getPublicConfig() {
    return this.shippingService.getPublicConfig();
  }

  @Get('estimate')
  @ApiOperation({ summary: 'Ước tính phí giao hàng theo toạ độ GPS' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  estimateFee(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('amount') amount?: string,
  ) {
    return this.shippingService.estimateFee(
      parseFloat(lat),
      parseFloat(lng),
      amount ? parseFloat(amount) : 0,
    );
  }
}
