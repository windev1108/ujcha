import { Body, Controller, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GroupOrderService } from '../../group-order/group-order.service';
import { UpdateGroupOrderConfigDto } from '../../group-order/dto/group-order.dto';

@ApiTags('admin-group-orders')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/group-orders')
export class AdminGroupOrderController {
  constructor(private readonly groupOrderService: GroupOrderService) {}

  @Get('config')
  @ApiOperation({ summary: 'Lấy cấu hình đơn nhóm & giảm giá nhóm' })
  getConfig() {
    return this.groupOrderService.getConfig();
  }

  @Put('config')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cập nhật cấu hình đơn nhóm & bậc giảm giá' })
  updateConfig(@Body() dto: UpdateGroupOrderConfigDto) {
    return this.groupOrderService.updateConfig({
      isEnabled: dto.isEnabled,
      expiryMinutes: dto.expiryMinutes,
      discountTiers: dto.discountTiers,
    });
  }
}
