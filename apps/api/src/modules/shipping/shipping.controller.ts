import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
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
  @ApiOperation({
    summary:
      'Ước tính phí giao hàng theo toạ độ GPS (đã gồm phụ phí thời tiết)',
  })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'amount', type: Number, required: false })
  estimateFee(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('amount') amount?: string,
  ) {
    const latN = Number(lat);
    const lngN = Number(lng);
    const amountN = amount ? Number(amount) : 0;
    if (
      !Number.isFinite(latN) ||
      !Number.isFinite(lngN) ||
      Math.abs(latN) > 90 ||
      Math.abs(lngN) > 180 ||
      !Number.isFinite(amountN) ||
      amountN < 0
    ) {
      throw new BadRequestException('Toạ độ hoặc giá trị đơn không hợp lệ');
    }
    return this.shippingService.estimateFee(latN, lngN, amountN);
  }
}
