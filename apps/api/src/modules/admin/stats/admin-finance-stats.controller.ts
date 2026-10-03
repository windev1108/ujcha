// src/modules/admin/stats/admin-finance-stats.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminFinanceStatsService } from './admin-finance-stats.service';
import { AdminCustomerStatsService } from './admin-customer-stats.service';

@ApiTags('admin-stats')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
// Cân nhắc đổi thành chỉ super_admin nếu không muốn nhân viên xem giá vốn / lợi nhuận.
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/stats')
export class AdminFinanceStatsController {
  constructor(
    private readonly service: AdminFinanceStatsService,
    private readonly customers: AdminCustomerStatsService,
  ) {}

  @Get('finance')
  @ApiOperation({
    summary:
      'Tổng quan doanh thu, giảm giá, phí ship, giá vốn và lợi nhuận (kèm kỳ trước để so sánh)',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'YYYY-MM-DD (giờ VN)',
  })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (giờ VN)' })
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.overview({ from, to });
  }

  @Get('customers')
  @ApiOperation({
    summary: 'Phân bố khách theo vùng (lưới toạ độ) và tỉ lệ khách đặt lại',
  })
  customerOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cell') cell?: string,
  ) {
    return this.customers.overview({
      from,
      to,
      cell: cell ? Number(cell) : undefined,
    });
  }
}
