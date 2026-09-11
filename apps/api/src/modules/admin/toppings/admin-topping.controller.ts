// src/modules/admin/toppings/admin-topping.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminToppingService } from './admin-topping.service';
import { SetToppingOutOfStockDto } from '../../topping/dto/set-topping-out-of-stock.dto';

@ApiTags('admin-toppings')
@ApiBearerAuth('admin-access-token')
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.super_admin, AdminRole.staff)
@Controller('admin/toppings')
export class AdminToppingController {
  constructor(private readonly service: AdminToppingService) {}

  @Get()
  @ApiOperation({
    summary:
      'Danh sách tên topping duy nhất (gom từ mọi sản phẩm) + trạng thái hết hàng global',
  })
  list() {
    return this.service.listDistinctToppings();
  }

  @Post('out-of-stock')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đánh dấu / bỏ đánh dấu 1 tên topping hết hàng toàn shop',
  })
  setOutOfStock(@Body() dto: SetToppingOutOfStockDto) {
    return this.service.setOutOfStock(dto);
  }
}
