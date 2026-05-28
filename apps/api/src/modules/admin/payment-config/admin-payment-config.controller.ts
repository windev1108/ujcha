import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPaymentConfigService } from './admin-payment-config.service';
import { UpdatePaymentConfigDto } from './dto/update-payment-config.dto';

@ApiTags('admin-payment-config')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/payment-config')
export class AdminPaymentConfigController {
  constructor(private readonly service: AdminPaymentConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy cấu hình thanh toán SePay QR' })
  get() {
    return this.service.get();
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật cấu hình thanh toán SePay QR' })
  update(@Body() dto: UpdatePaymentConfigDto) {
    return this.service.update(dto);
  }
}
