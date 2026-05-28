import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminReferralService } from './admin-referral.service';
import { AdminReferralInvitationsQueryDto } from './dto/admin-referral-invitations-query.dto';
import { AdminReferralRewardsQueryDto } from './dto/admin-referral-rewards-query.dto';
import { AdminReferralUsersQueryDto } from './dto/admin-referral-users-query.dto';
import { UpdateReferralProgramDto } from './dto/update-referral-program.dto';

@ApiTags('admin-referrals')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/referrals')
export class AdminReferralController {
  constructor(private readonly adminReferralService: AdminReferralService) { }

  @Get('dashboard')
  @ApiOperation({
    summary:
      'Tổng quan referral: thống kê, top 5, lượt đăng ký qua giới thiệu theo ngày (30 ngày)',
  })
  getDashboard() {
    return this.adminReferralService.getDashboard();
  }

  @Get('users')
  @ApiOperation({
    summary: 'Danh sách người dùng (mã giới thiệu, điểm, trạng thái) — phân trang',
  })
  listReferralUsers(@Query() query: AdminReferralUsersQueryDto) {
    return this.adminReferralService.listReferralUsers(query);
  }

  @Get('program-config')
  @ApiOperation({ summary: 'Cấu hình chương trình giới thiệu' })
  getProgramConfig() {
    return this.adminReferralService.getProgramConfig();
  }

  @Patch('program-config')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật cấu hình chương trình giới thiệu' })
  updateProgramConfig(@Body() dto: UpdateReferralProgramDto) {
    return this.adminReferralService.updateProgramConfig(dto);
  }

  @Get('invitations')
  @ApiOperation({
    summary: 'Ai mời ai — user có referredBy + thông tin referrer',
  })
  listInvitations(@Query() query: AdminReferralInvitationsQueryDto) {
    return this.adminReferralService.listInvitations(query);
  }

  @Get('stats/invite-counts')
  @ApiOperation({ summary: 'Số lượt mời theo mã referrer (referredBy)' })
  inviteCounts() {
    return this.adminReferralService.inviteCountsByReferrer();
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Danh sách phần thưởng giới thiệu (có tổng số)' })
  listRewards(@Query() query: AdminReferralRewardsQueryDto) {
    return this.adminReferralService.listRewards(query);
  }

  @Get('rewards/:id')
  @ApiOperation({ summary: 'Chi tiết reward' })
  getReward(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminReferralService.getRewardById(id);
  }
}
