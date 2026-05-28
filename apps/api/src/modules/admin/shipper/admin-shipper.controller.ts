import {
  Body,
  Controller,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminShipperService } from './admin-shipper.service';
import { CreateShipperDto } from './dto/create-shipper.dto';
import { FromStaffShipperDto } from './dto/from-staff-shipper.dto';
import { ToggleShipperAvailabilityDto } from './dto/toggle-shipper-availability.dto';
import { UpdateShipperDto } from './dto/update-shipper.dto';

@ApiTags('admin-shippers')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/shippers')
export class AdminShipperController {
  constructor(private readonly adminShipperService: AdminShipperService) { }

  @Get()
  @ApiOperation({ summary: 'Danh sách shipper' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description: 'true = chỉ shipper đang hoạt động',
  })
  list(@Query('activeOnly') activeOnly?: string) {
    return this.adminShipperService.list(activeOnly === 'true');
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'KPI shipper (tổng đăng ký, đang bật, sẵn sàng không bận đơn, TB thời gian giao)',
  })
  getStats() {
    return this.adminShipperService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết shipper' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminShipperService.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo shipper (thủ công)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateShipperDto) {
    return this.adminShipperService.create(dto);
  }

  @Post('from-staff')
  @HttpCode(201)
  @ApiOperation({ summary: 'Thêm shipper từ tài khoản staff' })
  @ApiResponse({ status: 201 })
  fromStaff(@Body() dto: FromStaffShipperDto) {
    return this.adminShipperService.fromStaff(dto);
  }

  @Patch(':id/availability')
  @ApiOperation({ summary: 'Bật/tắt shipper (isActive)' })
  toggleAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleShipperAvailabilityDto,
  ) {
    return this.adminShipperService.toggleAvailability(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật shipper' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShipperDto,
  ) {
    return this.adminShipperService.update(id, dto);
  }
}
