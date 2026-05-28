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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminTableService } from './admin-table.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@ApiTags('admin-tables')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/tables')
export class AdminTableController {
  constructor(private readonly adminTableService: AdminTableService) { }

  @Get()
  @ApiOperation({ summary: 'Danh sách bàn' })
  list() {
    return this.adminTableService.list();
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'KPI bàn (tổng, đang dùng, capacity %, bàn mới tuần này, tổng đơn đặt tại bàn)',
  })
  getStats() {
    return this.adminTableService.getStats();
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'URL QR (path /table/{tableId})' })
  getQr(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTableService.getQrPayload(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bàn' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTableService.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo bàn + sinh qrCode = {APP_PUBLIC_URL}/table/{id}' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateTableDto) {
    return this.adminTableService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật tên bàn' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.adminTableService.update(id, dto);
  }

  @Post(':id/regenerate-qr')
  @ApiOperation({ summary: 'Tạo lại qrCode theo APP_PUBLIC_URL' })
  regenerateQr(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTableService.regenerateQr(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Tắt bàn (isActive = false)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTableService.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Xóa bàn (chỉ khi chưa có đơn gắn bàn)',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminTableService.remove(id);
  }
}
