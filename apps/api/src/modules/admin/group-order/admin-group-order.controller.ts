import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GroupOrderService } from '../../group-order/group-order.service';
import { AdminUpdateStatusDto, UpdateGroupOrderConfigDto } from '../../group-order/dto/group-order.dto';

@ApiTags('admin-group-orders')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/group-orders')
export class AdminGroupOrderController {
  constructor(private readonly groupOrderService: GroupOrderService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn nhóm đang mở' })
  findAllActive() {
    return this.groupOrderService.findAllActive();
  }

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

  @Get(':token')
  @ApiOperation({ summary: 'Chi tiết đơn nhóm (admin)' })
  findOne(@Param('token') token: string) {
    return this.groupOrderService.adminFindByToken(token);
  }

  @Patch(':token/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin cập nhật trạng thái đơn nhóm' })
  updateStatus(@Param('token') token: string, @Body() dto: AdminUpdateStatusDto) {
    return this.groupOrderService.adminUpdateStatus(token, dto.status);
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Admin xóa đơn nhóm' })
  async deleteOne(@Param('token') token: string) {
    await this.groupOrderService.adminDelete(token);
  }
}
