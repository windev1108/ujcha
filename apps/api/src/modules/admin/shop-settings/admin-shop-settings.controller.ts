import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminShopSettingsService } from './admin-shop-settings.service';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import { UpdateTtsConfigDto } from './dto/update-tts-config.dto';

@ApiTags('admin-shop-settings')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/shop-settings')
export class AdminShopSettingsController {
  constructor(private readonly shopSettingsService: AdminShopSettingsService) { }

  @Get()
  @ApiOperation({ summary: 'Cấu hình giảm giá toàn shop' })
  get() {
    return this.shopSettingsService.get();
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật % giảm giá áp dụng cho toàn bộ sản phẩm' })
  update(@Body() dto: UpdateShopSettingsDto) {
    return this.shopSettingsService.update(dto);
  }

  @Get('tts-config')
  @ApiOperation({ summary: 'Lấy cấu hình giọng đọc TTS' })
  getTtsConfig() {
    return this.shopSettingsService.getTtsConfig();
  }

  @Patch('tts-config')
  @ApiOperation({ summary: 'Cập nhật cấu hình giọng đọc TTS' })
  updateTtsConfig(@Body() dto: UpdateTtsConfigDto) {
    return this.shopSettingsService.updateTtsConfig(dto);
  }
}
