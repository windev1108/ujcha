import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin/auth/admin-jwt.guard';
import { RolesGuard } from '../admin/auth/guards/roles.guard';
import { PricingConfigService } from './pricing-config.service';
import { Roles } from '../admin/auth/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';
import { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';
import { PricingService } from './pricing.service';
import { ApiOperation } from '@nestjs/swagger';

@Controller('admin/pricing')
@UseGuards(AdminJwtGuard, RolesGuard)
export class AdminPricingController {
  constructor(
    private readonly config: PricingConfigService,
    private readonly pricing: PricingService,
  ) { }

  @Get('config')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  getConfig() {
    return this.config.get(true);
  }

  @Patch('config')
  @Roles(AdminRole.super_admin) // công tắc tổng ảnh hưởng toàn bộ giá → chỉ super_admin
  async updateConfig(@Body() dto: UpdatePricingConfigDto) {
    const cfg = await this.config.update(dto);
    const recomputed = await this.pricing.recompute();
    return { ...cfg, recomputed };
  }

  @Post('recompute')
  @HttpCode(200)
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Tính lại giá tự động cho toàn bộ món' })
  recompute() {
    return this.pricing.recompute();
  }
}
