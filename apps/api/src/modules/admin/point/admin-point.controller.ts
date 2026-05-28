import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import type { AdminJwtUser } from '../auth/admin-jwt.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminPointService } from './admin-point.service';
import { AdminPointTransactionsQueryDto } from './dto/admin-point-transactions-query.dto';
import { AdminPointsAdjustDto } from './dto/admin-points-adjust.dto';
import { AdminPointsListQueryDto } from './dto/admin-points-list-query.dto';

@ApiTags('admin-points')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin')
export class AdminPointController {
  constructor(private readonly adminPointService: AdminPointService) { }

  @Get('point-transactions')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({
    summary: 'Lịch sử giao dịch điểm toàn hệ thống (phân trang)',
  })
  listAllPointTransactions(@Query() query: AdminPointTransactionsQueryDto) {
    return this.adminPointService.listAllTransactions(query);
  }

  @Get('users/:userId/point-transactions')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({
    summary: 'Lịch sử giao dịch điểm của user (lọc earn / spend / expire)',
  })
  listUserPointTransactions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AdminPointsListQueryDto,
  ) {
    return this.adminPointService.listUserTransactions(userId, query);
  }

  @Post('points/adjust')
  @Roles(AdminRole.super_admin)
  @ApiOperation({
    summary: 'Cộng / trừ điểm thủ công (ghi AdminActionLog)',
  })
  adjustPoints(
    @CurrentAdmin() admin: AdminJwtUser,
    @Body() dto: AdminPointsAdjustDto,
  ) {
    return this.adminPointService.adjustPoints(admin.adminId, dto);
  }
}
