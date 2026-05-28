import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator';
import { PointRewardService } from './point-reward.service';

@ApiTags('point-rewards')
@Controller('point-rewards')
export class PointRewardController {
  constructor(private readonly pointRewardService: PointRewardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Danh mục phần thưởng đổi điểm (active)' })
  listCatalog() {
    return this.pointRewardService.listCatalog();
  }

  @Post(':id/redeem')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Đổi điểm lấy voucher' })
  redeem(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) catalogId: string,
  ) {
    return this.pointRewardService.redeemReward(userId, catalogId);
  }
}
