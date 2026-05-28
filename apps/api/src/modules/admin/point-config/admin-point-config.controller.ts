import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { AdminPointConfigService } from './admin-point-config.service';
import { CreatePointCampaignDto } from './dto/create-point-campaign.dto';
import { UpdatePointCampaignDto } from './dto/update-point-campaign.dto';
import { UpdatePointConfigDto } from './dto/update-point-config.dto';

@ApiTags('admin-point-config')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/point-config')
export class AdminPointConfigController {
  constructor(private readonly adminPointConfigService: AdminPointConfigService) { }

  @Get('stats')
  @ApiOperation({
    summary:
      'Tổng điểm đang lưu hành (sum pointBalance), số user có điểm > 0, số thành viên đã xác minh SĐT',
  })
  getStats() {
    return this.adminPointConfigService.getStats();
  }

  @Get()
  @ApiOperation({
    summary:
      'Cấu hình điểm đang active + campaign trong khung giờ (nếu có); effectiveEarnPercent = campaign nếu override',
  })
  getCurrentConfig() {
    return this.adminPointConfigService.getCurrentConfig();
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Danh sách campaign' })
  getAllCampaigns() {
    return this.adminPointConfigService.getAllCampaigns();
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Tạo campaign' })
  createCampaign(@Body() dto: CreatePointCampaignDto) {
    return this.adminPointConfigService.createCampaign(dto);
  }

  @Patch('campaigns/:campaignId/toggle')
  @ApiOperation({ summary: 'Bật/tắt campaign' })
  toggleCampaign(@Param('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.adminPointConfigService.toggleCampaign(campaignId);
  }

  @Patch('campaigns/:campaignId')
  @ApiOperation({ summary: 'Cập nhật campaign' })
  updateCampaign(
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: UpdatePointCampaignDto,
  ) {
    return this.adminPointConfigService.updateCampaign(campaignId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật PointConfig; bật isActive sẽ tắt các config khác' })
  updateConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePointConfigDto,
  ) {
    return this.adminPointConfigService.updateConfig(id, dto);
  }
}
