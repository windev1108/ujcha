// point-campaign.controller.ts (hoặc tách file point-public.controller.ts nếu muốn rõ ràng hơn)
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderPointApplyService } from '../order/order-point-apply.service';

@ApiTags('points')
@Controller('point-config')
export class PointPublicController {
  constructor(
    private readonly orderPointApplyService: OrderPointApplyService,
  ) {}

  @Get('public')
  @ApiOperation({
    summary: 'Cấu hình điểm public: pointRate, maxUsagePercent, minOrderAmount',
  })
  async getPublicConfig() {
    return this.orderPointApplyService.getPublicRedemptionConfig();
  }
}
