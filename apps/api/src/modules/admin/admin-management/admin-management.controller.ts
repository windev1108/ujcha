import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminManagementService } from './admin-management.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminManagementListQueryDto } from './dto/admin-management-list-query.dto';
import type { AdminJwtUser } from '../auth/admin-jwt.types';

@ApiTags('admin-management')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/admins')
export class AdminManagementController {
  constructor(private readonly service: AdminManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách admin (chỉ super_admin)' })
  list(@Query() query: AdminManagementListQueryDto) {
    return this.service.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê admin' })
  stats() {
    return this.service.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết admin' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo admin mới' })
  create(@Body() dto: CreateAdminDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật role admin' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentAdmin() currentAdmin: AdminJwtUser,
  ) {
    return this.service.update(id, dto, currentAdmin.adminId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa admin' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() currentAdmin: AdminJwtUser,
  ) {
    await this.service.remove(id, currentAdmin.adminId);
  }
}
