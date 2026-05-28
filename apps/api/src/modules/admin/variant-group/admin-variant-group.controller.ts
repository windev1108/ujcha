import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminVariantGroupService } from './admin-variant-group.service';
import { CreateVariantGroupDto } from './dto/create-variant-group.dto';
import { UpdateVariantGroupDto } from './dto/update-variant-group.dto';

@ApiTags('admin-variant-groups')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/variant-groups')
export class AdminVariantGroupController {
  constructor(private readonly service: AdminVariantGroupService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách biến thể' })
  list() { return this.service.list(); }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết biến thể' })
  getById(@Param('id', ParseUUIDPipe) id: string) { return this.service.getById(id); }

  @Post()
  @HttpCode(201)
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Tạo biến thể' })
  create(@Body() dto: CreateVariantGroupDto) { return this.service.create(dto); }

  @Patch(':id')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật biến thể' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVariantGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Xóa biến thể' })
  async remove(@Param('id', ParseUUIDPipe) id: string) { await this.service.remove(id); }
}
