import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../admin/auth/admin-jwt.guard';
import { Roles } from '../admin/auth/decorators/roles.decorator';
import { RolesGuard } from '../admin/auth/guards/roles.guard';
import { UpdatePosReleaseDto } from './dto/update-pos-release.dto';
import { PosReleaseService } from './pos-release.service';

@ApiTags('pos-release')
@Controller('kun-pos')
export class PosReleaseController {
  constructor(private readonly service: PosReleaseService) { }

  @Get('version')
  @ApiOperation({ summary: 'Phiên bản UjCha POS mới nhất (public)' })
  get() {
    return this.service.get();
  }

  @Put('version')
  @ApiBearerAuth('admin-access-token')
  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật thông tin phiên bản UjCha POS (super_admin)' })
  update(@Body() dto: UpdatePosReleaseDto) {
    return this.service.update(dto);
  }
}
