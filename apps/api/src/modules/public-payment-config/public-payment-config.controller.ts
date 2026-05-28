import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminPaymentConfigService } from '../admin/payment-config/admin-payment-config.service';

@ApiTags('payment-config')
@Controller('payment-config')
export class PublicPaymentConfigController {
  constructor(private readonly service: AdminPaymentConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy thông tin thanh toán công khai (không có sePayApiKey)' })
  async get() {
    const config = await this.service.get();
    return {
      bankCode: config.bankCode,
      accountNumber: config.accountNumber,
      accountName: config.accountName,
      isEnabled: config.isEnabled,
    };
  }
}
