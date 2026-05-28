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
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminToppingService } from './admin-topping.service';
import { CreateToppingDto } from './dto/create-topping.dto';
import { UpdateToppingDto } from './dto/update-topping.dto';

@ApiTags('admin-toppings')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/toppings')
export class AdminToppingController {
  constructor(private readonly adminToppingService: AdminToppingService) { }

  @Get()
  @ApiOperation({ summary: 'Danh sách topping' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    description: 'true = chỉ topping đang bật',
  })
  list(@Query('activeOnly') activeOnly?: string) {
    return this.adminToppingService.list(activeOnly === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết topping' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminToppingService.getById(id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo topping' })
  create(@Body() dto: CreateToppingDto) {
    return this.adminToppingService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật topping' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateToppingDto,
  ) {
    return this.adminToppingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Xóa topping' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminToppingService.remove(id);
  }
}
