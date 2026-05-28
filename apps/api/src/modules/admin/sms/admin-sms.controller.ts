import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminSmsService } from './admin-sms.service';
import { AdminSmsListQueryDto } from './dto/admin-sms-list-query.dto';

@ApiTags('admin-sms')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/sms')
export class AdminSmsController {
  constructor(private readonly service: AdminSmsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách SMS đã gửi' })
  list(@Query() query: AdminSmsListQueryDto) {
    return this.service.listLogs(query.page ?? 1, query.limit ?? 20, query.phone);
  }
}
