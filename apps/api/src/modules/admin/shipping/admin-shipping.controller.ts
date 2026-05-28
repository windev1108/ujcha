import { Body, Controller, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShippingService } from '../../shipping/shipping.service';
import { UpdateShippingConfigDto } from '../../shipping/dto/update-shipping-config.dto';

@ApiTags('admin-shipping')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/shipping')
export class AdminShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('config')
  @ApiOperation({ summary: 'Lấy cấu hình phí giao hàng' })
  getConfig() {
    return this.shippingService.getConfig();
  }

  @Put('config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật cấu hình phí giao hàng' })
  updateConfig(@Body() dto: UpdateShippingConfigDto) {
    return this.shippingService.updateConfig(dto);
  }
}
