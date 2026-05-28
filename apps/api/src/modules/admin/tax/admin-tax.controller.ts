import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import type { Response } from 'express';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminTaxService } from './admin-tax.service';
import { CreateVatConfigDto } from './dto/create-vat-config.dto';
import { UpdateVatConfigDto } from './dto/update-vat-config.dto';
import {
  TaxOverviewQueryDto,
  TaxReportQueryDto,
  TaxTransactionQueryDto,
} from './dto/tax-query.dto';

@ApiTags('admin-tax')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/tax')
export class AdminTaxController {
  constructor(private readonly service: AdminTaxService) {}

  @Get('vat-configs')
  @ApiOperation({ summary: 'Danh sách cấu hình VAT' })
  getVatConfigs() {
    return this.service.getVatConfigs();
  }

  @Post('vat-configs')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Tạo cấu hình VAT mới' })
  createVatConfig(@Body() dto: CreateVatConfigDto) {
    return this.service.createVatConfig(dto);
  }

  @Patch('vat-configs/:id')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật cấu hình VAT' })
  updateVatConfig(@Param('id') id: string, @Body() dto: UpdateVatConfigDto) {
    return this.service.updateVatConfig(id, dto);
  }

  @Delete('vat-configs/:id')
  @Roles(AdminRole.super_admin)
  @HttpCode(204)
  @ApiOperation({ summary: 'Xoá cấu hình VAT (chỉ khi chưa có đơn hàng)' })
  deleteVatConfig(@Param('id') id: string) {
    return this.service.deleteVatConfig(id);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Tổng quan doanh thu & thuế GTGT theo ngày' })
  getOverview(@Query() query: TaxOverviewQueryDto) {
    return this.service.getOverview(query);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Danh sách giao dịch kèm thuế GTGT (phân trang)' })
  getTransactions(@Query() query: TaxTransactionQueryDto) {
    return this.service.getTransactions(query);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Báo cáo tổng hợp doanh thu & thuế theo ngày/tháng' })
  getReports(@Query() query: TaxReportQueryDto) {
    return this.service.getReports(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Xuất danh sách giao dịch dạng CSV (UTF-8 BOM)' })
  async exportCsv(@Query() query: TaxOverviewQueryDto, @Res() res: Response) {
    const csv = await this.service.exportCsv(query.from, query.to);
    const filename = `tax-export-${query.from ?? 'all'}-${query.to ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + csv);
  }
}
