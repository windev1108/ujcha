import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminMetricsQueryDto } from './dto/admin-metrics-query.dto';

@ApiTags('admin-metrics')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/metrics')
export class AdminMetricsController {
  constructor(private readonly adminMetricsService: AdminMetricsService) { }

  @Get()
  @ApiOperation({
    summary:
      'Thống kê: revenue (đơn đã thanh toán), orders, users, referrals; groupBy day/week/month (UTC)',
  })
  getMetrics(@Query() query: AdminMetricsQueryDto) {
    return this.adminMetricsService.getMetrics(query);
  }
}
