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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminJwtUser } from '../auth/admin-jwt.types';
import { HrmService } from './hrm.service';
import { UpdateStoreLocationDto } from './dto/update-store-location.dto';
import { UpdateFaceProfileDto } from './dto/update-face-profile.dto';
import { CheckinDto } from './dto/checkin.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { UpdateShiftConfigDto } from './dto/update-shift-config.dto';
import { CreateStaffDto } from './dto/create-staff.dto';

@ApiTags('admin-hrm')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/hrm')
export class HrmController {
  constructor(private readonly hrmService: HrmService) {}

  // ─── Shift config ──────────────────────────────────────────────────

  @Get('shift-config')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Lấy cấu hình ca làm việc' })
  getShiftConfig() {
    return this.hrmService.getShiftConfig();
  }

  @Put('shift-config')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật cấu hình ca làm việc (super_admin)' })
  updateShiftConfig(@Body() dto: UpdateShiftConfigDto) {
    return this.hrmService.updateShiftConfig(dto);
  }

  // ─── Store location (super_admin only) ────────────────────────────

  @Get('store-location')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Lấy cấu hình vị trí cửa hàng' })
  getStoreLocation() {
    return this.hrmService.getStoreLocation();
  }

  @Put('store-location')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật vị trí cửa hàng (super_admin)' })
  updateStoreLocation(@Body() dto: UpdateStoreLocationDto) {
    return this.hrmService.updateStoreLocation(dto);
  }

  // ─── Staff CRUD (super_admin only) ────────────────────────────────

  @Get('staff')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Danh sách nhân viên (super_admin)' })
  listStaff() {
    return this.hrmService.listStaff();
  }

  @Post('staff')
  @HttpCode(201)
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Tạo tài khoản nhân viên/admin mới (super_admin)' })
  createStaff(@Body() dto: CreateStaffDto) {
    return this.hrmService.createStaff(dto);
  }

  @Patch('staff/:staffId')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật thông tin nhân viên (super_admin)' })
  updateStaff(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() body: { name?: string; phone?: string; email?: string; isActive?: boolean },
  ) {
    return this.hrmService.updateStaff(staffId, body);
  }

  @Post('staff/:staffId/reset-password')
  @HttpCode(200)
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Đặt lại mật khẩu nhân viên (super_admin)' })
  resetPassword(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() body: { password?: string },
  ) {
    return this.hrmService.resetStaffPassword(staffId, body.password);
  }

  @Delete('staff/:staffId')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Xoá tài khoản nhân viên (super_admin)' })
  deleteStaff(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.hrmService.deleteStaff(staffId);
  }

  // ─── Face profile ──────────────────────────────────────────────────

  @Get('staff/:staffId/face-profile')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Lấy hồ sơ khuôn mặt nhân viên (super_admin)' })
  getFaceProfile(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.hrmService.getFaceProfile(staffId);
  }

  @Put('staff/:staffId/face-profile')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật/tạo hồ sơ khuôn mặt nhân viên (super_admin)' })
  upsertFaceProfile(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateFaceProfileDto,
  ) {
    return this.hrmService.upsertFaceProfile(staffId, dto);
  }

  @Get('staff/:staffId/permissions')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Lấy quyền trang của nhân viên (super_admin)' })
  getPermissions(@Param('staffId', ParseUUIDPipe) staffId: string) {
    return this.hrmService.getPermissions(staffId);
  }

  @Put('staff/:staffId/permissions')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật quyền trang của nhân viên (super_admin)' })
  updatePermissions(
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.hrmService.updatePermissions(staffId, dto.permissions);
  }

  // ─── My face profile (staff reads own) ───────────────────────────

  @Get('my-face-profile')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Lấy face descriptor của chính mình (để check-in)' })
  getMyFaceProfile(@CurrentAdmin() admin: AdminJwtUser) {
    return this.hrmService.getFaceProfile(admin.adminId);
  }

  // ─── Attendance ────────────────────────────────────────────────────

  @Get('attendance')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Danh sách chấm công raw (super_admin, lọc theo nhân viên / ngày)' })
  listAttendance(@Query() query: AttendanceQueryDto) {
    return this.hrmService.listAttendance(query);
  }

  @Get('attendance/daily-summary')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Tổng hợp chấm công theo nhân viên + ngày (super_admin)' })
  listDailySummary(@Query() query: AttendanceQueryDto) {
    return this.hrmService.listDailySummary(query);
  }

  @Get('attendance/today')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Bản ghi check-in/out hôm nay của mình' })
  getMyToday(@CurrentAdmin() admin: AdminJwtUser) {
    return this.hrmService.getMyTodayRecord(admin.adminId);
  }

  @Post('attendance/checkin')
  @HttpCode(201)
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Check-in (validate GPS + face)' })
  checkin(@CurrentAdmin() admin: AdminJwtUser, @Body() dto: CheckinDto) {
    return this.hrmService.checkin(admin.adminId, dto);
  }

  @Post('attendance/checkout')
  @HttpCode(201)
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Check-out (validate GPS + face)' })
  checkout(@CurrentAdmin() admin: AdminJwtUser, @Body() dto: CheckinDto) {
    return this.hrmService.checkout(admin.adminId, dto);
  }
}
