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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminStoreService } from './admin-store.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';

@ApiTags('admin-store')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/store')
export class AdminStoreController {
  constructor(private readonly service: AdminStoreService) {}

  @Get('platforms')
  @Roles(AdminRole.super_admin, AdminRole.staff)
  @ApiOperation({ summary: 'Danh sách nền tảng giao đồ ăn' })
  list() {
    return this.service.listPlatforms();
  }

  @Post('platforms')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Thêm nền tảng giao đồ ăn' })
  create(@Body() dto: CreatePlatformDto) {
    return this.service.createPlatform(dto);
  }

  @Patch('platforms/:id')
  @Roles(AdminRole.super_admin)
  @ApiOperation({ summary: 'Cập nhật nền tảng giao đồ ăn' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlatformDto) {
    return this.service.updatePlatform(id, dto);
  }

  @Delete('platforms/:id')
  @Roles(AdminRole.super_admin)
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa nền tảng giao đồ ăn' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deletePlatform(id);
  }
}
