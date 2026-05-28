import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOverviewService } from './admin-overview.service';

@ApiTags('admin-overview')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly adminOverviewService: AdminOverviewService) { }

  @Get()
  @ApiOperation({
    summary:
      'Dashboard tổng quan: metric 7 ngày vs 7 ngày trước, doanh thu theo ngày, phân bổ loại đơn, đơn gần đây',
  })
  getDashboard() {
    return this.adminOverviewService.getDashboard();
  }
}
