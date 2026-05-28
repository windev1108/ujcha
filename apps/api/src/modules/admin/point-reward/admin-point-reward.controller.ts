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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PointRewardService } from '../../point/point-reward.service';
import {
  CreatePointRewardDto,
  UpdatePointRewardDto,
} from './dto/upsert-point-reward.dto';

@ApiTags('admin-point-rewards')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin)
@Controller('admin/point-rewards')
export class AdminPointRewardController {
  constructor(private readonly pointRewardService: PointRewardService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tất cả phần thưởng đổi điểm (kể cả inactive)' })
  list() {
    return this.pointRewardService.adminList();
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo phần thưởng đổi điểm' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreatePointRewardDto) {
    return this.pointRewardService.adminCreate(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật phần thưởng đổi điểm' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePointRewardDto,
  ) {
    return this.pointRewardService.adminUpdate(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa phần thưởng đổi điểm' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.pointRewardService.adminDelete(id);
  }
}
