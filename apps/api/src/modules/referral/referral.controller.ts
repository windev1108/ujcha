import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { MilestoneTierId } from './referral.service';
import { ReferralService } from './referral.service';

class ClaimMilestoneDto {
  @IsIn(['bronze', 'silver', 'gold', 'diamond'])
  tier!: MilestoneTierId;
}

@ApiTags('referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('public-config')
  @ApiOperation({ summary: 'Cấu hình chương trình giới thiệu (public)' })
  getPublicConfig() {
    return this.referralService.getPublicConfig();
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Top 10 người giới thiệu nhiều nhất (public)' })
  getLeaderboard() {
    return this.referralService.getLeaderboard();
  }

  @Get('my-stats')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thống kê referral của user hiện tại' })
  getMyStats(@CurrentUserId() userId: string) {
    return this.referralService.getMyStats(userId);
  }

  @Get('my-invitations')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Danh sách người đăng ký qua mã của tôi — kèm trạng thái và lý do từ chối',
  })
  getMyInvitations(@CurrentUserId() userId: string) {
    return this.referralService.getMyInvitations(userId);
  }

  @Get('my-claimed-milestones')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Danh sách mốc thưởng user đã claim' })
  getClaimedMilestones(@CurrentUserId() userId: string) {
    return this.referralService.getClaimedMilestones(userId);
  }

  @Post('claim-milestone')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Nhận thưởng mốc affiliate' })
  claimMilestone(
    @CurrentUserId() userId: string,
    @Body() dto: ClaimMilestoneDto,
  ) {
    return this.referralService.claimMilestoneTier(userId, dto.tier);
  }
}
