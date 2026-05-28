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
  Query,
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
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminJwtUser } from '../auth/admin-jwt.types';
import { AdminPostService } from './admin-post.service';
import { AdminPostListQueryDto } from './dto/admin-post-list-query.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@ApiTags('admin-posts')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/posts')
export class AdminPostController {
  constructor(private readonly adminPostService: AdminPostService) { }

  @Get()
  @ApiOperation({ summary: 'Danh sách bài (lọc status, type)' })
  findAll(@Query() query: AdminPostListQueryDto) {
    return this.adminPostService.findAll(query);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Tạo bài — slug sinh từ title; contentFormat = markdown | html',
  })
  @ApiResponse({ status: 201 })
  create(
    @CurrentAdmin() admin: AdminJwtUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.adminPostService.create(admin.adminId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bài' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminPostService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật (đổi title → slug mới nếu trùng sẽ suffix)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.adminPostService.update(id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({
    summary: 'Xuất bản — status=published, publishedAt=now',
  })
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminPostService.publish(id);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Gỡ xuất bản — status=draft, publishedAt=null' })
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminPostService.unpublish(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa bài' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminPostService.remove(id);
  }
}
