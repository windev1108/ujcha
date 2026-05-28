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
import { AdminFraudInsightsService } from './admin-fraud-insights.service';
import { AdminFraudInsightsQueryDto } from './dto/admin-fraud-insights-query.dto';

@ApiTags('admin-fraud-insights')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/fraud-insights')
export class AdminFraudInsightsController {
  constructor(
    private readonly adminFraudInsightsService: AdminFraudInsightsService,
  ) { }

  @Get('overview')
  @ApiOperation({
    summary:
      'Spam / tín hiệu: user suspicious, cụm cùng IP, cụm cùng device (registration*)',
  })
  overview(@Query() query: AdminFraudInsightsQueryDto) {
    return this.adminFraudInsightsService.overview(query);
  }
}
