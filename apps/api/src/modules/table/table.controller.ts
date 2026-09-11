import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderType, PaymentType } from '@prisma/client';
import { OrdersGateway } from '../events/orders.gateway';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableOrderDto } from './dto/create-table-order.dto';

@ApiTags('tables')
@Controller('tables')
export class TableController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Thông tin bàn công khai (không cần auth)' })
  async getPublicTable(@Param('id', ParseUUIDPipe) id: string) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      select: { id: true, name: true, area: true, isActive: true },
    });
    if (!table) {
      throw new NotFoundException({
        message: 'Không tìm thấy bàn.',
        code: 'TABLE_NOT_FOUND',
      });
    }
    return table;
  }

  @Post(':id/order')
  @HttpCode(201)
  @ApiOperation({ summary: 'Tạo đơn tại bàn (không cần đăng nhập)' })
  async createTableOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTableOrderDto,
  ) {
    const order = await this.orderService.createOrder(null, {
      type: OrderType.table,
      paymentType: dto.paymentType ?? PaymentType.cash,
      tableId: id,
      items: dto.items,
    });
    this.ordersGateway.emitOrderCreated({
      orderId: order.id,
      type: order.type,
    });
    return order;
  }
}
