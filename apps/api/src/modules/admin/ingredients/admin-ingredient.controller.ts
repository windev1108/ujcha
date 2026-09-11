// admin/ingredients/admin-ingredient.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminIngredientService } from './admin-ingredient.service';
import { AdjustIngredientStockDto } from '../inventory/dto/adjust-ingredient-stock.dto';
import { UpdateIngredientDto } from '../inventory/dto/update-ingredient.dto';
import { CreateIngredientDto } from '../inventory/dto/create-ingredient.dto';

@ApiTags('admin-ingredients')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/ingredients')
export class AdminIngredientController {
  constructor(private readonly service: AdminIngredientService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nguyên liệu' })
  list(@Query('q') q?: string) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nguyên liệu' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Lịch sử nhập/xuất kho' })
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.history(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo nguyên liệu' })
  create(@Body() dto: CreateIngredientDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật nguyên liệu' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Nhập kho / điều chỉnh tồn kho thủ công' })
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustIngredientStockDto,
  ) {
    return this.service.adjustStock(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa nguyên liệu (chưa dùng trong công thức nào)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
