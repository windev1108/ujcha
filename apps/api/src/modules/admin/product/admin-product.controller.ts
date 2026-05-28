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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminProductService } from './admin-product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ToggleProductAvailabilityDto } from './dto/toggle-product-availability.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('admin-products')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/products')
export class AdminProductController {
  constructor(private readonly adminProductService: AdminProductService) { }

  @Get()
  @ApiOperation({ summary: 'Danh sách sản phẩm' })
  @ApiQuery({ name: 'categoryId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'q', required: false, description: 'Tìm theo tên / SKU / mô tả' })
  list(
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
    @Query('q') q?: string,
  ) {
    return this.adminProductService.list(categoryId, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết sản phẩm' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminProductService.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo sản phẩm' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateProductDto) {
    return this.adminProductService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật sản phẩm' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.adminProductService.update(id, dto);
  }

  @Patch(':id/availability')
  @ApiOperation({ summary: 'Bật/tắt bán (isAvailable)' })
  toggleAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleProductAvailabilityDto,
  ) {
    return this.adminProductService.toggleAvailability(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa sản phẩm (không còn tham chiếu giỏ/đơn)' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminProductService.remove(id);
  }
}
