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
import { AdminVoucherService } from './admin-voucher.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';

@ApiTags('admin-vouchers')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/vouchers')
export class AdminVoucherController {
  constructor(private readonly adminVoucherService: AdminVoucherService) { }

  @Post('validate-rule')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Kiểm tra quy tắc voucher (không lưu DB)',
  })
  @ApiResponse({ status: 200 })
  validateRule(@Body() dto: CreateVoucherDto) {
    return this.adminVoucherService.validateRulePayload(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách voucher' })
  list() {
    return this.adminVoucherService.list();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê voucher (dashboard)' })
  stats() {
    return this.adminVoucherService.getDashboardStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết voucher' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminVoucherService.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo voucher (validate rule + mã unique)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateVoucherDto) {
    return this.adminVoucherService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật voucher' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.adminVoucherService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa voucher' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminVoucherService.remove(id);
  }
}
